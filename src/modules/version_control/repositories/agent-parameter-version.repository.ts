import {
  FragmentRepository,
  InjectRepository,
  IsNull,
  Repository,
} from "fragment-ts";
import { AgentParameter } from "../../../entities/agent-parameter.entity";

@FragmentRepository()
export class AgentParameterVersionRepository {
  @InjectRepository(AgentParameter)
  private agentParameterRepository!: Repository<AgentParameter>;

  async findLiveByAgentId(agentId: string): Promise<AgentParameter | null> {
    return this.agentParameterRepository.findOne({
      where: {
        agentId,
        commitHash: IsNull(),
      },
      relations: {
        voiceProfile: true,
        capabilityProfile: {
          toolPolicies: {
            platformTool: true,
          },
        },
        contextRuleSet: true,
      },
      order: {
        updatedAt: "DESC",
      },
    });
  }

  async findByCommitHash(
    agentId: string,
    commitHash: string,
  ): Promise<AgentParameter | null> {
    return this.agentParameterRepository.findOne({
      where: {
        agentId,
        commitHash,
      },
      relations: {
        voiceProfile: true,
        capabilityProfile: {
          toolPolicies: {
            platformTool: true,
          },
        },
        contextRuleSet: true,
      },
      order: {
        updatedAt: "DESC",
      },
    });
  }

  async save(input: Partial<AgentParameter>): Promise<AgentParameter> {
    return this.agentParameterRepository.save(input);
  }

  async deleteLiveByAgentId(agentId: string): Promise<void> {
    await this.agentParameterRepository.delete({
      agentId,
      commitHash: IsNull(),
    });
  }
}
