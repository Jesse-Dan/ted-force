import { createHash, randomBytes } from "node:crypto";
import { Autowired, Service } from "fragment-ts";
import {
  DEFAULT_SDK_RATE_LIMIT_POLICY,
  DEFAULT_SDK_SECURITY_POLICY,
  DEFAULT_SDK_WIDGET_CONFIG,
  DEFAULT_SDK_WIDGET_THEME,
  type AgentConfig,
  type SdkRateLimitPolicy,
  type SdkSecurityPolicy,
  type SdkWidgetConfig,
} from "../../../entities/agent-config.entity";
import { RequestContextHolder } from "../../../common/context/request-context-holder";
import { ConfigService } from "../../config/services/config.service";
import { AgentSdkApiKeyRepository } from "../repositories/agent-sdk-api-key.repository";
import { SdkConfigService } from "./sdk-config.service";

export type SdkApiScope = "read" | "write" | "admin";
type SdkWidgetUpdateInput = {
  widgetKey?: string | null;
  allowedDomains?: string[];
  embedEnabled?: boolean;
  theme?: Partial<NonNullable<NonNullable<AgentConfig["sdkWidget"]>["theme"]>>;
};

@Service()
export class SdkManagementService {
  @Autowired()
  private configService!: ConfigService;

  @Autowired()
  private sdkConfigService!: SdkConfigService;

  @Autowired()
  private agentSdkApiKeyRepository!: AgentSdkApiKeyRepository;

  async getAgentSdkManagement(agentId: string) {
    const config = await this.configService.getAgentConfig(agentId);
    const keys = await this.agentSdkApiKeyRepository.findActiveByAgentId(agentId);
    const endpointCatalog = this.sdkConfigService.getEndpointCatalog();
    const widget = this.ensureWidgetConfig(config);
    const rateLimits = this.ensureRateLimits(config);
    const security = this.ensureSecurity(config);

    return {
      overview: {
        keyCount: keys.length,
        endpointCount: endpointCatalog.length,
        widgetEnabled: widget.embedEnabled,
        widgetDomainCount: widget.allowedDomains.length,
        widgetKeyConfigured: Boolean(widget.widgetKey),
        requestsPerMinute: rateLimits.requestsPerMinute,
        burstCapacity: rateLimits.burstCapacity,
        ipRuleCount: security.allowedIpAddresses.length,
      },
      keys: keys.map((key) => ({
        id: key.id,
        name: key.name,
        maskedKey: key.keyMask,
        scopes: key.scopes,
        status: key.revokedAt ? "revoked" : "active",
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
      })),
      endpointCatalog,
      rateLimits,
      security,
      widget: {
        ...widget,
        widgetKeyMasked: widget.widgetKey ? this.maskKey(widget.widgetKey) : null,
        embedSnippet: this.buildEmbedSnippet(agentId, widget),
        configEndpoint: `${this.sdkConfigService.getBaseUrl()}/sdk/agents/${agentId}/widget?widgetKey=${widget.widgetKey ?? "<widget_key>"}`,
        embedEndpoint: `${this.sdkConfigService.getBaseUrl()}/sdk/agents/${agentId}/widget/embed?widgetKey=${widget.widgetKey ?? "<widget_key>"}`,
      },
    };
  }

  async createApiKey(agentId: string, payload: { name: string; scopes?: string[] | null }) {
    const scopes = this.normalizeScopes(payload.scopes);
    const token = this.generateApiKey(agentId);
    const saved = await this.agentSdkApiKeyRepository.save({
      agentId,
      name: payload.name.trim() || "SDK key",
      keyPrefix: token.slice(0, 12),
      keyMask: this.maskKey(token),
      tokenHash: this.hashToken(token),
      scopes,
      createdByUserId: RequestContextHolder.get()?.userId ?? null,
    });

    return {
      id: saved.id,
      name: saved.name,
      maskedKey: saved.keyMask,
      scopes: saved.scopes,
      status: "active",
      createdAt: saved.createdAt,
      plainTextKey: token,
    };
  }

  async revokeApiKey(agentId: string, keyId: string) {
    const key = await this.agentSdkApiKeyRepository.findByIdAndAgentId(keyId, agentId);
    if (!key) {
      throw new Error("API key not found.");
    }

    if (key.revokedAt) {
      return key;
    }

    return this.agentSdkApiKeyRepository.save({
      ...key,
      revokedAt: new Date(),
    });
  }

  async updateRateLimits(agentId: string, payload: Partial<SdkRateLimitPolicy>) {
    const config = await this.configService.getAgentConfig(agentId);
    return this.configService.upsertAgentConfig(agentId, {
      sdkRateLimits: {
        ...this.ensureRateLimits(config),
        ...payload,
      },
    });
  }

  async updateSecurity(agentId: string, payload: Partial<SdkSecurityPolicy>) {
    const config = await this.configService.getAgentConfig(agentId);
    const current = this.ensureSecurity(config);

    return this.configService.upsertAgentConfig(agentId, {
      sdkSecurity: {
        ...current,
        ...payload,
        allowedIpAddresses: this.normalizeIpAddresses(
          payload.allowedIpAddresses ?? current.allowedIpAddresses,
        ),
      },
    });
  }

  async updateWidget(agentId: string, payload: SdkWidgetUpdateInput) {
    const config = await this.configService.getAgentConfig(agentId);
    const current = this.ensureWidgetConfig(config);
    const next = {
      ...current,
      ...payload,
      allowedDomains: this.normalizeDomains(payload.allowedDomains ?? current.allowedDomains),
      theme: {
        ...current.theme,
        ...(payload.theme ?? {}),
      },
    };

    return this.configService.upsertAgentConfig(agentId, {
      sdkWidget: next,
    });
  }

  async regenerateWidgetKey(agentId: string) {
    const config = await this.configService.getAgentConfig(agentId);
    const widget = this.ensureWidgetConfig(config);
    const nextKey = `wgt_${randomBytes(10).toString("hex")}`;

    const updated = await this.configService.upsertAgentConfig(agentId, {
      sdkWidget: {
        ...widget,
        widgetKey: nextKey,
        embedEnabled: true,
      },
    });

    return {
      widgetKey: nextKey,
      widgetKeyMasked: this.maskKey(nextKey),
      embedSnippet: this.buildEmbedSnippet(agentId, this.ensureWidgetConfig(updated)),
    };
  }

  getPublicEndpointCatalog(agentId: string) {
    return {
      agentId,
      baseUrl: this.sdkConfigService.getBaseUrl(),
      endpoints: this.sdkConfigService.getEndpointCatalog(),
    };
  }

  async getPublicWidgetConfig(agentId: string, widgetKey: string | null, origin?: string | null) {
    const config = await this.configService.getAgentConfig(agentId);
    const widget = this.ensureWidgetConfig(config);

    this.assertWidgetAccess(widget, widgetKey, origin);

    return {
      agentId,
      widgetKey: widget.widgetKey,
      allowedDomains: widget.allowedDomains,
      theme: widget.theme,
      greetingPrompt: widget.theme.greetingPrompt,
      launcherLabel: widget.theme.launcherLabel,
      promptEndpoint: `${this.sdkConfigService.getBaseUrl()}/sdk/agents/${agentId}/prompt`,
      conversationsEndpoint: `${this.sdkConfigService.getBaseUrl()}/sdk/agents/${agentId}/conversations/:sessionId`,
      messagesEndpoint: `${this.sdkConfigService.getBaseUrl()}/sdk/agents/${agentId}/messages/:conversationId`,
    };
  }

  async getPublicWidgetTheme(agentId: string, widgetKey: string | null, origin?: string | null) {
    const config = await this.configService.getAgentConfig(agentId);
    const widget = this.ensureWidgetConfig(config);

    this.assertWidgetAccess(widget, widgetKey, origin);

    return {
      agentId,
      theme: widget.theme,
    };
  }

  async getPublicWidgetEmbed(agentId: string, widgetKey: string | null, origin?: string | null) {
    const config = await this.configService.getAgentConfig(agentId);
    const widget = this.ensureWidgetConfig(config);

    this.assertWidgetAccess(widget, widgetKey, origin);

    return {
      agentId,
      widgetKey: widget.widgetKey,
      snippet: this.buildEmbedSnippet(agentId, widget),
    };
  }

  async getPublicRateLimits(agentId: string) {
    const config = await this.configService.getAgentConfig(agentId);
    return {
      agentId,
      rateLimits: this.ensureRateLimits(config),
    };
  }

  async getPublicSecurity(agentId: string) {
    const config = await this.configService.getAgentConfig(agentId);
    return {
      agentId,
      security: this.ensureSecurity(config),
    };
  }

  private assertWidgetAccess(
    widget: SdkWidgetConfig,
    widgetKey: string | null,
    origin?: string | null,
  ) {
    if (!widget.embedEnabled || !widget.widgetKey) {
      throw new Error("Widget embedding is not enabled for this agent.");
    }

    if (!widgetKey || widgetKey !== widget.widgetKey) {
      throw new Error("Invalid widget key.");
    }

    if (!origin || widget.allowedDomains.length === 0) {
      return;
    }

    const normalizedOrigin = this.normalizeDomain(origin);
    const isAllowed = widget.allowedDomains.some((domain: string) =>
      this.normalizeDomain(domain) === normalizedOrigin,
    );

    if (!isAllowed) {
      throw new Error("Origin is not allowed for this widget.");
    }
  }

  private buildEmbedSnippet(agentId: string, widget: SdkWidgetConfig) {
    const baseUrl = this.sdkConfigService.getBaseUrl();
    const safeKey = widget.widgetKey ?? "<widget_key>";

    return [
      `<script>`,
      `  window.TuulWidget = window.TuulWidget || {};`,
      `  window.TuulWidget.agentId = "${agentId}";`,
      `  window.TuulWidget.widgetKey = "${safeKey}";`,
      `  window.TuulWidget.origin = window.location.origin;`,
      `  window.TuulWidget.configUrl = "${baseUrl}/sdk/agents/${agentId}/widget?widgetKey=${safeKey}&origin=" + encodeURIComponent(window.location.origin);`,
      `</script>`,
      `<script src="${baseUrl}/sdk/agents/${agentId}/widget/embed?widgetKey=${safeKey}&origin=\${encodeURIComponent(window.location.origin)}" async></script>`,
    ].join("\n");
  }

  private ensureRateLimits(config: AgentConfig): SdkRateLimitPolicy {
    return {
      ...DEFAULT_SDK_RATE_LIMIT_POLICY,
      ...(config.sdkRateLimits ?? {}),
    };
  }

  private ensureSecurity(config: AgentConfig): SdkSecurityPolicy {
    return {
      ...DEFAULT_SDK_SECURITY_POLICY,
      ...(config.sdkSecurity ?? {}),
      allowedIpAddresses: config.sdkSecurity?.allowedIpAddresses ?? [],
    };
  }

  private ensureWidgetConfig(config: AgentConfig): SdkWidgetConfig {
    return {
      ...DEFAULT_SDK_WIDGET_CONFIG,
      ...(config.sdkWidget ?? {}),
      theme: {
        ...DEFAULT_SDK_WIDGET_THEME,
        ...(config.sdkWidget?.theme ?? {}),
      },
      allowedDomains: config.sdkWidget?.allowedDomains ?? [],
    };
  }

  private normalizeScopes(scopes?: string[] | null): SdkApiScope[] {
    const normalized = Array.from(
      new Set(
        (scopes ?? ["read"])
          .map((scope) => scope.trim().toLowerCase())
          .filter(Boolean),
      ),
    ).filter((scope): scope is SdkApiScope =>
      ["read", "write", "admin"].includes(scope),
    );

    return normalized.length > 0 ? normalized : ["read"];
  }

  private normalizeDomains(domains: string[]) {
    return Array.from(
      new Set(
        domains
          .map((domain) => this.normalizeDomain(domain))
          .filter(Boolean),
      ),
    );
  }

  private normalizeIpAddresses(addresses: string[]) {
    return Array.from(
      new Set(addresses.map((address) => address.trim()).filter(Boolean)),
    );
  }

  private normalizeDomain(value: string | null | undefined) {
    const trimmed = value?.trim();
    if (!trimmed) {
      return "";
    }

    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "")
      .toLowerCase();
  }

  private generateApiKey(agentId: string) {
    return `agt_${agentId.replace(/-/g, "").slice(0, 8)}_${randomBytes(18).toString("hex")}`;
  }

  private hashToken(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private maskKey(value: string) {
    if (value.length <= 10) {
      return value;
    }

    return `${value.slice(0, 8)}…${value.slice(-4)}`;
  }
}
