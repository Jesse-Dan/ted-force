import { Autowired, Service } from "fragment-ts";
import {
  AgentConfig,
  DEFAULT_SDK_RATE_LIMIT_POLICY,
  DEFAULT_SDK_SECURITY_POLICY,
  DEFAULT_SDK_WIDGET_CONFIG,
  DEFAULT_SDK_WIDGET_THEME,
  DEFAULT_RUNTIME_LIMITS,
} from "../../../entities/agent-config.entity";
import { ModelFamily } from "../../../entities/enums/model-family.enum";
import { ModelProvider } from "../../../entities/enums/model-provider.enum";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { UpsertAgentConfigDto } from "../dto/upsert-agent-config.dto";
import { AgentConfigRepository } from "../repositories/agent-config.repository";

type PartialSdkWidgetInput =
  | {
      widgetKey?: string | null;
      allowedDomains?: string[];
      embedEnabled?: boolean;
      theme?: Partial<NonNullable<NonNullable<AgentConfig["sdkWidget"]>["theme"]>> | null;
    }
  | null
  | undefined;

@Service()
export class ConfigService {
  @Autowired()
  private agentConfigRepository!: AgentConfigRepository;

  @Autowired()
  private agentRepository!: AgentRepository;

  async getAgentConfig(agentId: string): Promise<AgentConfig> {
    const existing = await this.agentConfigRepository.findByAgentId(agentId);

    if (existing) {
      return this.applyConfigDefaults(existing);
    }

    return this.createDefaultConfig(agentId);
  }

  async upsertAgentConfig(agentId: string, payload: UpsertAgentConfigDto): Promise<AgentConfig> {
    const existing = await this.agentConfigRepository.findByAgentId(agentId);

    if (!existing) {
      const defaults = await this.createDefaultConfig(agentId);
      const created = await this.agentConfigRepository.save({
        ...defaults,
        agentId,
        ...payload,
        runtimeLimits: this.mergeRuntimeLimits(defaults.runtimeLimits, payload.runtimeLimits),
        sdkRateLimits: this.mergeSdkRateLimits(defaults.sdkRateLimits, payload.sdkRateLimits),
        sdkSecurity: this.mergeSdkSecurity(defaults.sdkSecurity, payload.sdkSecurity),
        sdkWidget: this.mergeSdkWidget(defaults.sdkWidget, payload.sdkWidget),
      });

      return this.applyConfigDefaults(created);
    }

    const updated = await this.agentConfigRepository.save({
      ...existing,
      ...payload,
      runtimeLimits: this.mergeRuntimeLimits(existing.runtimeLimits, payload.runtimeLimits),
      sdkRateLimits: this.mergeSdkRateLimits(existing.sdkRateLimits, payload.sdkRateLimits),
      sdkSecurity: this.mergeSdkSecurity(existing.sdkSecurity, payload.sdkSecurity),
      sdkWidget: this.mergeSdkWidget(existing.sdkWidget, payload.sdkWidget),
    });

    return this.applyConfigDefaults(updated);
  }

  private async createDefaultConfig(agentId: string): Promise<AgentConfig> {
    const agent = await this.agentRepository.findById(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const config = await this.agentConfigRepository.save({
      agentId,
      provider: ModelProvider.GEMINI,
      model: ModelFamily.GEMINI_2_5_FLASH_LITE,
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1,
      topK: 50,
      isSystemHealthy: true,
      runtimeLimits: DEFAULT_RUNTIME_LIMITS,
      sdkRateLimits: DEFAULT_SDK_RATE_LIMIT_POLICY,
      sdkSecurity: DEFAULT_SDK_SECURITY_POLICY,
      sdkWidget: DEFAULT_SDK_WIDGET_CONFIG,
    });

    return this.applyConfigDefaults(config);
  }

  private applyConfigDefaults(config: AgentConfig): AgentConfig {
    return {
      ...config,
      runtimeLimits: this.mergeRuntimeLimits(DEFAULT_RUNTIME_LIMITS, config.runtimeLimits),
      sdkRateLimits: this.mergeSdkRateLimits(
        DEFAULT_SDK_RATE_LIMIT_POLICY,
        config.sdkRateLimits,
      ),
      sdkSecurity: this.mergeSdkSecurity(
        DEFAULT_SDK_SECURITY_POLICY,
        config.sdkSecurity,
      ),
      sdkWidget: this.mergeSdkWidget(DEFAULT_SDK_WIDGET_CONFIG, config.sdkWidget),
    };
  }

  private mergeRuntimeLimits(
    base?: AgentConfig["runtimeLimits"] | null,
    incoming?: Partial<NonNullable<AgentConfig["runtimeLimits"]>> | null,
  ): NonNullable<AgentConfig["runtimeLimits"]> {
    return {
      ...DEFAULT_RUNTIME_LIMITS,
      ...(base ?? {}),
      ...(incoming ?? {}),
    };
  }

  private mergeSdkRateLimits(
    base?: AgentConfig["sdkRateLimits"] | null,
    incoming?: Partial<NonNullable<AgentConfig["sdkRateLimits"]>> | null,
  ): NonNullable<AgentConfig["sdkRateLimits"]> {
    return {
      ...DEFAULT_SDK_RATE_LIMIT_POLICY,
      ...(base ?? {}),
      ...(incoming ?? {}),
    };
  }

  private mergeSdkSecurity(
    base?: AgentConfig["sdkSecurity"] | null,
    incoming?: Partial<NonNullable<AgentConfig["sdkSecurity"]>> | null,
  ): NonNullable<AgentConfig["sdkSecurity"]> {
    return {
      ...DEFAULT_SDK_SECURITY_POLICY,
      ...(base ?? {}),
      allowedIpAddresses:
        incoming?.allowedIpAddresses ?? base?.allowedIpAddresses ?? [],
    };
  }

  private mergeSdkWidget(
    base?: AgentConfig["sdkWidget"] | null,
    incoming?: PartialSdkWidgetInput,
  ): NonNullable<AgentConfig["sdkWidget"]> {
    return {
      ...DEFAULT_SDK_WIDGET_CONFIG,
      ...(base ?? {}),
      theme: {
        ...DEFAULT_SDK_WIDGET_THEME,
        ...(base?.theme ?? {}),
        ...(incoming?.theme ?? {}),
      },
      allowedDomains: incoming?.allowedDomains ?? base?.allowedDomains ?? [],
      widgetKey: incoming?.widgetKey ?? base?.widgetKey ?? null,
      embedEnabled: incoming?.embedEnabled ?? base?.embedEnabled ?? false,
    };
  }
}
