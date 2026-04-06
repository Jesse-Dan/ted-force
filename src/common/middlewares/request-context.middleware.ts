import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { RequestContextHolder } from "../context/request-context-holder";

export class RequestContextMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = this.readHeader(req, "x-request-id") ?? randomUUID();

    RequestContextHolder.run(
      {
        requestId,
        requestStartedAt: Date.now(),
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: this.readHeader(req, "user-agent"),
        userId: this.readHeader(req, "x-user-id"),
        organizationId: this.readHeader(req, "x-organization-id"),
        agentId: this.readHeader(req, "x-agent-id"),
        sessionId: this.readHeader(req, "x-session-id"),
        conversationId: this.readHeader(req, "x-conversation-id"),
        apiKey: this.readHeader(req, "x-api-key"),
        authorization: this.readHeader(req, "authorization"),
        publicAccess:
          req.path.startsWith("/public") ||
          req.path.startsWith("/sdk") ||
          req.path.startsWith("/marketplace"),
      },
      () => {
        res.setHeader("x-request-id", requestId);
        next();
      },
    );
  }

  private readHeader(req: Request, name: string): string | undefined {
    const value = req.headers[name];

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }
}
