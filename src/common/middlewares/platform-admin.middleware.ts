import { Autowired, Injectable } from "fragment-ts";
import express from "express";
import { RequestContextHolder } from "../context/request-context-holder";
import { UserAccountRepository } from "../../modules/auth/repositories/user-account.repository";

@Injectable()
export class PlatformAdminMiddleware {
  @Autowired()
  private userAccountRepository!: UserAccountRepository;

  async use(
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): Promise<void> {
    const context = RequestContextHolder.get();
    const userId = context?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          type: "UNAUTHORIZED",
          message: "User context is required.",
        },
        meta: {
          status: 401,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const user = await this.userAccountRepository.findById(userId).catch(() => null);

    if (!user?.isPlatformAdmin) {
      res.status(403).json({
        success: false,
        error: {
          type: "FORBIDDEN",
          message: "Platform admin access is required.",
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
}
