import type { Request, Response } from "express";
import { RequestContextHolder } from "../context/request-context-holder";

export class RequestTracingInterceptor {
  intercept(_req: Request, res: Response, result: unknown): unknown {
    const context = RequestContextHolder.get();

    if (context && !res.headersSent) {
      res.setHeader("x-request-id", context.requestId);

      if (context.organizationId) {
        res.setHeader("x-organization-id", context.organizationId);
      }

      if (context.agentId) {
        res.setHeader("x-agent-id", context.agentId);
      }
    }

    return result;
  }
}
