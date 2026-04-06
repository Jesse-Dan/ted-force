import type { Request, Response } from "express";
import { RequestContextHolder } from "../context/request-context-holder";

export class TimingInterceptor {
  intercept(_req: Request, res: Response, result: unknown): unknown {
    const context = RequestContextHolder.get();

    if (context && !res.headersSent) {
      res.setHeader("x-response-time-ms", String(Date.now() - context.requestStartedAt));
    }

    return result;
  }
}
