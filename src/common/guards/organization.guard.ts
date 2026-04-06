import type { Request } from "express";
import { RequestContextHolder } from "../context/request-context-holder";

export class OrganizationGuard {
  canActivate(req: Request): boolean {
    const organizationId =
      this.readString(req.params?.organizationId) ??
      this.readBody(req, "organizationId") ??
      this.readQuery(req, "organizationId") ??
      this.readHeader(req, "x-organization-id");

    RequestContextHolder.patch({
      organizationId,
    });

    if (!this.requiresOrganization(req)) {
      return true;
    }

    return Boolean(organizationId);
  }

  private requiresOrganization(req: Request): boolean {
    if (req.path.includes("/billing") || req.path.includes("/credit-management")) {
      return true;
    }

    if (!req.path.includes("/organizations")) {
      return false;
    }

    if (
      req.path.includes("/organizations/user/") ||
      req.path.includes("/organizations/invitations/email/") ||
      req.path.includes("/organizations/verify-invitation") ||
      req.path.includes("/organizations/invitations/") ||
      req.path === "/organizations" ||
      req.path === "/organizations/"
    ) {
      return false;
    }

    return true;
  }

  private readHeader(req: Request, name: string): string | undefined {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private readBody(req: Request, key: string): string | undefined {
    const value = (req.body as Record<string, unknown> | undefined)?.[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private readQuery(req: Request, key: string): string | undefined {
    const value = req.query?.[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private readString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }
}
