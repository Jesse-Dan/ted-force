import { Autowired, Injectable } from "fragment-ts";
import express from "express";
import { AgentRepository } from "../../modules/agent/repositories/agent.repository";
import { OrganizationMembershipRepository } from "../../modules/organization/repositories/organization-membership.repository";
import {
  PermissionHubAction,
  PermissionHubScope,
} from "../context/request-context";
import { RequestContextHolder } from "../context/request-context-holder";

@Injectable()
export class PermissionHubMiddleware {
  @Autowired()
  private membershipRepository!: OrganizationMembershipRepository;

  @Autowired()
  private agentRepository!: AgentRepository;

  async use(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): Promise<void> {
    const currentContext = RequestContextHolder.get();
    const path = req.path ?? "";

    if (currentContext?.publicAccess || this.isBypassedPath(path)) {
      RequestContextHolder.patch({
        permissionHub: {
          action: this.resolveAction(req.method),
          scope: "unknown",
          role: null,
          allowed: true,
          organizationId: currentContext?.organizationId,
          agentId: currentContext?.agentId,
          permissions: this.buildPermissions(null),
        },
      });
      next();
      return;
    }

    const userId =
      this.readString(req.headers["x-user-id"]) ??
      this.readString(req.body?.userId) ??
      this.readString(req.query?.userId) ??
      currentContext?.userId;

    const agentId =
      this.readString(req.params?.agentId) ??
      this.readString(req.body?.agentId) ??
      this.readString(req.query?.agentId) ??
      this.readString(req.headers["x-agent-id"]) ??
      currentContext?.agentId;

    let organizationId =
      this.readString(req.params?.organizationId) ??
      this.readString(req.body?.organizationId) ??
      this.readString(req.query?.organizationId) ??
      this.readString(req.headers["x-organization-id"]) ??
      currentContext?.organizationId;

    if (!organizationId && agentId) {
      const agent = await this.agentRepository.findById(agentId).catch(() => null);
      organizationId = agent?.organizationId ?? organizationId;
    }

    const action = this.resolveAction(req.method);
    const scope = this.resolveScope(path, req.method, Boolean(agentId), Boolean(organizationId));

    if (!userId || (!organizationId && scope !== "unknown" && scope !== "agent.create")) {
      RequestContextHolder.patch({
        userId,
        agentId,
        organizationId,
        permissionHub: {
          action,
          scope,
          role: null,
          allowed: true,
          organizationId: organizationId ?? undefined,
          agentId: agentId ?? undefined,
          permissions: this.buildPermissions(null),
        },
      });
      next();
      return;
    }

    const membership =
      userId && organizationId
        ? await this.membershipRepository
            .findMembership(userId, organizationId)
            .catch(() => null)
        : null;

    const role =
      membership?.role === "owner" || membership?.role === "admin"
        ? membership.role
        : membership?.role === "member"
          ? "member"
          : null;
    const permissions = this.buildPermissions(role);
    const allowed = this.isAllowed(scope, action, permissions);

    RequestContextHolder.patch({
      userId,
      agentId,
      organizationId,
      permissionHub: {
        action,
        scope,
        role,
        allowed,
        organizationId: organizationId ?? undefined,
        agentId: agentId ?? undefined,
        permissions,
      },
    });

    if (!allowed) {
      res.status(403).json({
        success: false,
        error: {
          type: "FORBIDDEN",
          message: "Access denied",
          details: {
            scope,
            action,
            organizationId,
            agentId,
            role,
          },
        },
        meta: {
          status: 403,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  }

  private isBypassedPath(path: string): boolean {
    return (
      path.startsWith("/public") ||
      path.startsWith("/sdk") ||
      path.startsWith("/marketplace") ||
      path === "/status" ||
      path.startsWith("/status/")
    );
  }

  private resolveAction(method?: string): PermissionHubAction {
    switch ((method ?? "GET").toUpperCase()) {
      case "POST":
        return "create";
      case "PUT":
      case "PATCH":
        return "edit";
      case "DELETE":
        return "delete";
      default:
        return "view";
    }
  }

  private resolveScope(
    path: string,
    method: string | undefined,
    hasAgentId: boolean,
    hasOrganizationId: boolean,
  ): PermissionHubScope {
    if (path.includes("/organizations/") && path.includes("/transfer-ownership")) {
      return "organization.transfer";
    }
    if (path.includes("/organizations/") && path.includes("/git/")) {
      return "organization.repository";
    }
    if (
      path.includes("/organizations/") &&
      (path.includes("/members") || path.includes("/invitations"))
    ) {
      return "organization.members";
    }
    if (
      path.startsWith("/organizations/") &&
      hasOrganizationId &&
      !path.includes("/members") &&
      !path.includes("/invitations") &&
      !path.includes("/git/remote")
    ) {
      return "organization.profile";
    }
    if (
      path === "/agents" ||
      path === "/agents/" ||
      (path.startsWith("/agents") && !hasAgentId && (method ?? "GET").toUpperCase() === "POST")
    ) {
      return "agent.create";
    }
    if (path.startsWith("/agents/") && hasAgentId && (method ?? "GET").toUpperCase() === "DELETE") {
      return "agent.delete";
    }
    if (
      hasAgentId ||
      path.includes("/runtime") ||
      path.includes("/tools") ||
      path.includes("/files") ||
      path.includes("/preferences")
    ) {
      return "agent.workspace";
    }
    return "unknown";
  }

  private buildPermissions(role: string | null) {
    const isOwner = role === "owner";
    const isAdmin = role === "admin";
    const isMember = role === "member";
    return {
      canView: Boolean(role),
      canCreate: isOwner || isAdmin || isMember,
      canEdit: isOwner || isAdmin || isMember,
      canDelete: isOwner || isAdmin,
      canManageOrganizationSettings: isOwner || isAdmin,
      canManageMembers: isOwner || isAdmin,
      canTransferOwnership: isOwner,
    };
  }

  private isAllowed(
    scope: PermissionHubScope,
    action: PermissionHubAction,
    permissions: ReturnType<PermissionHubMiddleware["buildPermissions"]>,
  ): boolean {
    switch (scope) {
      case "organization.profile":
        if (action === "view") return permissions.canView;
        if (action === "delete") return permissions.canTransferOwnership;
        return permissions.canManageOrganizationSettings;
      case "organization.members":
        if (action === "view") return permissions.canView;
        return permissions.canManageMembers;
      case "organization.repository":
        if (action === "view") return permissions.canView;
        return permissions.canManageOrganizationSettings;
      case "organization.transfer":
        return permissions.canTransferOwnership;
      case "agent.create":
        return permissions.canCreate;
      case "agent.delete":
        return permissions.canDelete;
      case "agent.workspace":
        if (action === "view") return permissions.canView;
        if (action === "create") return permissions.canCreate;
        if (action === "edit") return permissions.canEdit;
        if (action === "delete") return permissions.canDelete;
        return permissions.canView;
      case "unknown":
      default:
        return true;
    }
  }

  private readString(value: unknown): string | undefined {
    if (Array.isArray(value)) {
      return this.readString(value[0]);
    }
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : undefined;
  }
}
