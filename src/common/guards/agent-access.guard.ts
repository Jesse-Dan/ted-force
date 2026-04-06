import type { Request } from "express";
import { RequestContextHolder } from "../context/request-context-holder";

export class AgentAccessGuard {
  canActivate(req: Request): boolean {
    const agentId =
      this.readString(req.params?.agentId) ??
      this.readBody(req, "agentId") ??
      this.readQuery(req, "agentId") ??
      this.readHeader(req, "x-agent-id");

    const sessionId =
      this.readBody(req, "sessionId") ??
      this.readQuery(req, "sessionId") ??
      this.readHeader(req, "x-session-id");

    const conversationId =
      this.readBody(req, "conversationId") ??
      this.readQuery(req, "conversationId") ??
      this.readHeader(req, "x-conversation-id");

    RequestContextHolder.patch({
      agentId,
      sessionId,
      conversationId,
    });

    if (!this.requiresAgent(req)) {
      return true;
    }

    return Boolean(agentId);
  }

  private requiresAgent(req: Request): boolean {
    if (
      req.path.startsWith("/sdk/conversations/") ||
      req.path.startsWith("/sdk/messages/") ||
      req.path.startsWith("/sdk/resources/") ||
      req.path === "/api/history" ||
      req.path === "/api/messages"
    ) {
      return false;
    }

    if (
      req.path === "/tools/keywords" ||
      req.path === "/tools/keywords/"
    ) {
      return false;
    }

    if (
      req.path === "/agents" ||
      req.path === "/agents/" ||
      req.path === "/agents/duplicate"
    ) {
      return false;
    }

    return (
      req.path.includes("/agents") ||
      req.path.includes("/runtime") ||
      req.path.includes("/tools") ||
      req.path.includes("/files") ||
      req.path.includes("/sdk") ||
      req.path.includes("/marketplace")
    );
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
