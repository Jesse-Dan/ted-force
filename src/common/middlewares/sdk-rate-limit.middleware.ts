import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Autowired } from "fragment-ts";
import { ConfigService } from "../../modules/config/services/config.service";

type RateWindow = {
  startedAt: number;
  count: number;
};

export class SdkRateLimitMiddleware {
  private static windows = new Map<string, RateWindow>();

  @Autowired()
  private configService!: ConfigService;

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!this.shouldProtect(req)) {
      next();
      return;
    }

    const agentId =
      this.readString(req.params?.agentId) ??
      this.readString((req.body as Record<string, unknown> | undefined)?.agentId) ??
      this.readString(req.query?.agentId) ??
      this.readHeader(req, "x-agent-id");

    if (!agentId) {
      next();
      return;
    }

    const config = await this.configService.getAgentConfig(agentId);
    const policy = config.sdkRateLimits ?? {
      requestsPerMinute: 120,
      burstCapacity: 300,
      adaptiveThrottling: true,
      blockAnonymousTraffic: false,
    };
    const allowedIpAddresses = config.sdkSecurity?.allowedIpAddresses ?? [];
    const clientIp = this.resolveClientIp(req);

    if (allowedIpAddresses.length === 0) {
      next(new Error("SDK security is not configured for this agent. Open Config > Security and add an allowed IP address or 0.0.0.0."));
      return;
    }

    if (!allowedIpAddresses.includes("0.0.0.0") && !allowedIpAddresses.includes(clientIp)) {
      next(
        new Error(
          `SDK access is not allowed from IP ${clientIp}. Update Config > Security to include this address or use 0.0.0.0.`,
        ),
      );
      return;
    }

    const apiKey =
      this.readHeader(req, "x-api-key") ??
      this.readBearerKey(this.readHeader(req, "authorization"));

    if (!apiKey && policy.blockAnonymousTraffic) {
      res.status(401).json({
        success: false,
        error: {
          type: "UNAUTHORIZED",
          message: "An API key is required for this SDK route.",
        },
      });
      return;
    }

    const identity = apiKey
      ? `key:${createHash("sha256").update(apiKey).digest("hex")}`
      : `anon:${clientIp}`;
    const windowKey = `${agentId}:${identity}`;
    const now = Date.now();
    const oneMinuteMs = 60_000;
    if (this.shouldRateLimit(req)) {
      const existing = SdkRateLimitMiddleware.windows.get(windowKey);
      const current =
        existing && now - existing.startedAt < oneMinuteMs
          ? existing
          : {
              startedAt: now,
              count: 0,
            };

      current.count += 1;
      SdkRateLimitMiddleware.windows.set(windowKey, current);

      const effectiveLimit = Math.max(
        policy.requestsPerMinute,
        policy.adaptiveThrottling ? policy.burstCapacity : policy.requestsPerMinute,
      );

      res.setHeader("x-ratelimit-limit", String(effectiveLimit));
      res.setHeader(
        "x-ratelimit-remaining",
        String(Math.max(0, effectiveLimit - current.count)),
      );

      if (current.count > effectiveLimit) {
        res.status(429).json({
          success: false,
          error: {
            type: "RATE_LIMITED",
            message: "SDK rate limit exceeded for this agent.",
          },
        });
        return;
      }
    }

    next();
  }

  private shouldProtect(req: Request) {
    return req.path.startsWith("/sdk/agents/");
  }

  private shouldRateLimit(req: Request) {
    return !(
      req.path.endsWith("/widget") ||
      req.path.endsWith("/widget/embed") ||
      req.path.endsWith("/endpoints")
    );
  }

  private readHeader(req: Request, name: string): string | undefined {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private readBearerKey(value?: string) {
    const header = value?.trim();
    if (!header?.toLowerCase().startsWith("bearer ")) {
      return null;
    }

    return header.slice(7).trim() || null;
  }

  private readString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private resolveClientIp(req: Request) {
    const forwarded = this.readHeader(req, "x-forwarded-for");
    const candidate =
      forwarded?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      "";

    return candidate.replace(/^::ffff:/, "") || "unknown";
  }
}
