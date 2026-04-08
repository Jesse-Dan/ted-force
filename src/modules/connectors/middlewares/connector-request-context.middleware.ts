import { Injectable } from "fragment-ts";
import express from "express";
import { RequestContextHolder } from "../../../common/context/request-context-holder";

@Injectable()
export class ConnectorRequestContextMiddleware {
  use(
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ): void {
    const current = RequestContextHolder.get();
    const metadata = current?.metadata ?? {};

    RequestContextHolder.patch({
      metadata: {
        ...metadata,
        connectorRequest: {
          method: req.method,
          params: this.sanitize(req.params),
          query: this.sanitize(req.query),
        },
      },
    });

    next();
  }

  private sanitize(value: unknown, depth = 0): unknown {
    if (depth > 5 || value === null || value === undefined) {
      return value ?? null;
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.sanitize(entry, depth + 1));
    }

    if (typeof value === "object") {
      return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
        (accumulator, [key, entry]) => {
          accumulator[key] = this.sanitize(entry, depth + 1);
          return accumulator;
        },
        {},
      );
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    return String(value);
  }
}
