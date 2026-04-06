import {
  Autowired,
  FragmentRepository,
  InjectRepository,
  Repository,
  Service,
} from "fragment-ts";
import { IsNull } from "typeorm";
import { AgentParameter } from "../../../entities/agent-parameter.entity";
import { CapabilityProfile } from "../../../entities/capability-profile.entity";
import { CapabilityToolPolicy } from "../../../entities/capability-tool-policy.entity";
import { ContextRuleSet } from "../../../entities/context-rule-set.entity";
import { VoiceProfile } from "../../../entities/voice-profile.entity";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { UpsertCapabilityProfileDto } from "../dto/upsert-capability-profile.dto";
import { UpsertContextRuleSetDto } from "../dto/upsert-context-rule-set.dto";
import { UpsertAgentParameterDto } from "../dto/upsert-agent-parameter.dto";
import { UpsertVoiceProfileDto } from "../dto/upsert-voice-profile.dto";

@Service()
@FragmentRepository()
export class PreferencesService {
  @InjectRepository(AgentParameter)
  private agentParameterRepository!: Repository<AgentParameter>;

  @InjectRepository(VoiceProfile)
  private voiceProfileRepository!: Repository<VoiceProfile>;

  @InjectRepository(CapabilityProfile)
  private capabilityProfileRepository!: Repository<CapabilityProfile>;

  @InjectRepository(CapabilityToolPolicy)
  private capabilityToolPolicyRepository!: Repository<CapabilityToolPolicy>;

  @InjectRepository(ContextRuleSet)
  private contextRuleSetRepository!: Repository<ContextRuleSet>;

  @Autowired()
  private agentRepository!: AgentRepository;

  async getPreferences(agentId: string) {
    return this.requireParameter(agentId);
  }

  async upsertParameter(agentId: string, payload: UpsertAgentParameterDto) {
    const parameter = await this.requireParameter(agentId);

    await this.agentParameterRepository.save({
      ...parameter,
      persona: payload.persona ?? parameter.persona ?? [],
      niche: payload.niche ?? parameter.niche ?? null,
      overview:
        payload.overview === undefined ? parameter.overview ?? null : payload.overview,
      documentation:
        payload.documentation === undefined
          ? parameter.documentation ?? null
          : payload.documentation,
      corePrompts: payload.corePrompts ?? parameter.corePrompts ?? [],
      responseFormat:
        payload.responseFormat ?? parameter.responseFormat ?? { type: "auto" },
    });

    return this.requireParameter(agentId);
  }

  async deleteParameter(agentId: string) {
    const parameter = await this.requireParameter(agentId);
    await this.agentParameterRepository.delete(parameter.id);
    return { id: parameter.id, deleted: true };
  }

  async upsertCapability(agentId: string, payload: UpsertCapabilityProfileDto) {
    const parameter = await this.requireParameter(agentId);
    const existing = parameter.capabilityProfile;

    const capability = await this.capabilityProfileRepository.save({
      id: existing?.id,
      agentParameterId: parameter.id,
      capabilityFlags: {
        ...(existing?.capabilityFlags ?? {}),
        thinking: true,
        toolUse: true,
        functionCalling: true,
        functionMemory: true,
        ...(payload.capabilityFlags ?? {}),
      },
      restrictions: payload.restrictions ?? existing?.restrictions ?? [],
    });

    if (payload.toolPolicies) {
      await this.capabilityToolPolicyRepository.delete({
        capabilityProfileId: capability.id,
      });

      const policies = payload.toolPolicies
        .filter((policy) => typeof policy.platformToolId === "string")
        .map((policy) => ({
          capabilityProfileId: capability.id,
          platformToolId: String(policy.platformToolId),
          userEnabled: Boolean(policy.userEnabled ?? true),
        }));

      if (policies.length > 0) {
        await this.capabilityToolPolicyRepository.save(policies);
      }
    }

    return this.requireParameter(agentId);
  }

  async upsertVoice(agentId: string, payload: UpsertVoiceProfileDto) {
    const parameter = await this.requireParameter(agentId);
    const existing = parameter.voiceProfile;

    await this.voiceProfileRepository.save({
      id: existing?.id,
      agentParameterId: parameter.id,
      coreVoiceProfile:
        payload.coreVoiceProfile ?? existing?.coreVoiceProfile ?? null,
      tonalPalette: payload.tonalPalette ?? existing?.tonalPalette ?? [],
      behavioralGuardrails:
        payload.behavioralGuardrails ?? existing?.behavioralGuardrails ?? [],
    });

    return this.requireParameter(agentId);
  }

  async upsertContextRules(agentId: string, payload: UpsertContextRuleSetDto) {
    const parameter = await this.requireParameter(agentId);
    const existing = parameter.contextRuleSet;

    await this.contextRuleSetRepository.save({
      id: existing?.id,
      agentParameterId: parameter.id,
      preset:
        (payload.preset as "balanced" | "strict" | "creative") ??
        existing?.preset ??
        "balanced",
      historyDepth: payload.historyDepth ?? existing?.historyDepth ?? 5,
      persistentMemory: payload.persistentMemory ?? existing?.persistentMemory ?? false,
      customBehavioralRules:
        payload.customBehavioralRules ?? existing?.customBehavioralRules ?? [],
    });

    return this.requireParameter(agentId);
  }

  private async requireParameter(agentId: string) {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    let parameter = await this.agentParameterRepository.findOne({
      where: {
        agentId,
        commitHash: IsNull(),
        instanceId: IsNull(),
      },
      relations: {
        capabilityProfile: {
          toolPolicies: true,
        },
        voiceProfile: true,
        contextRuleSet: true,
      },
      order: {
        createdAt: "DESC",
      },
    });

    if (!parameter) {
      await this.agentParameterRepository.save({
        agentId,
        persona: [],
        responseFormat: { type: "auto" },
      });

      parameter = await this.agentParameterRepository.findOne({
        where: {
          agentId,
          commitHash: IsNull(),
          instanceId: IsNull(),
        },
        relations: {
          capabilityProfile: {
            toolPolicies: true,
          },
          voiceProfile: true,
          contextRuleSet: true,
        },
        order: {
          createdAt: "DESC",
        },
      });
    }

    if (!parameter) {
      throw new Error(`Unable to initialize preferences for agent ${agentId}.`);
    }

    return parameter;
  }
}
