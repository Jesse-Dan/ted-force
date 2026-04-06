import type { Request } from "express";
import { RequestContextHolder } from "../context/request-context-holder";

export class AuthGuard {
  canActivate(req: Request): boolean {
    const isPublic =
      req.path.startsWith("/public") ||
      req.path.startsWith("/sdk") ||
      req.path.startsWith("/marketplace");
    const headerUserId = this.readHeader(req, "x-user-id");
    const bodyUserId = this.readBody(req, "userId");
    const queryUserId = this.readQuery(req, "userId");
    const hasAuthorizationHeader = Boolean(this.readHeader(req, "authorization"));

    RequestContextHolder.patch({
      publicAccess: isPublic,
      userId:
        bodyUserId ??
        queryUserId ??
        headerUserId ??
        RequestContextHolder.get()?.userId,
    });

    return (
      isPublic ||
      hasAuthorizationHeader ||
      Boolean(
        bodyUserId ??
          queryUserId ??
          headerUserId ??
          RequestContextHolder.get()?.userId,
      )
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
}
