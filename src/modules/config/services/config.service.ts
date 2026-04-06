import { Autowired, Service } from "fragment-ts";
import {
  AgentConfig,
  DEFAULT_ACCESS_POLICY,
  DEFAULT_RUNTIME_LIMITS,
} from "../../../entities/agent-config.entity";
import { ModelFamily } from "../../../entities/enums/model-family.enum";
import { ModelProvider } from "../../../entities/enums/model-provider.enum";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { UpsertAgentConfigDto } from "../dto/upsert-agent-config.dto";
import { AgentConfigRepository } from "../repositories/agent-config.repository";

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
      });

      return this.applyConfigDefaults(created);
    }

    const updated = await this.agentConfigRepository.save({
      ...existing,
      ...payload,
      runtimeLimits: this.mergeRuntimeLimits(existing.runtimeLimits, payload.runtimeLimits),
    });

    return this.applyConfigDefaults(updated);
  }

  async regenerateApiKey(agentId: string) {
    const config = await this.getAgentConfig(agentId);
    const nextKey = `agt_${agentId.replace(/-/g, "").slice(0, 8)}_${Date.now().toString(36)}`;

    return this.agentConfigRepository.save({
      ...config,
      apiKey: nextKey,
    });
  }

  async revokeApiKey(agentId: string) {
    const config = await this.getAgentConfig(agentId);
    return this.agentConfigRepository.save({
      ...config,
      apiKey: null,
    });
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
      accessPolicy: DEFAULT_ACCESS_POLICY,
    });

    return this.applyConfigDefaults(config);
  }

  private applyConfigDefaults(config: AgentConfig): AgentConfig {
    return {
      ...config,
      runtimeLimits: this.mergeRuntimeLimits(DEFAULT_RUNTIME_LIMITS, config.runtimeLimits),
      accessPolicy: config.accessPolicy ?? DEFAULT_ACCESS_POLICY,
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
}
