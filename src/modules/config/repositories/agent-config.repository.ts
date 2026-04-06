import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { AgentConfig } from "../../../entities/agent-config.entity";

@FragmentRepository()
export class AgentConfigRepository {
  @InjectRepository(AgentConfig)
  private agentConfigRepository!: Repository<AgentConfig>;

  async findByAgentId(agentId: string): Promise<AgentConfig | null> {
    return this.agentConfigRepository.findOne({
      where: { agentId },
      relations: {
        agent: true,
      },
    });
  }

  async findByAgentIdAndApiKey(
    agentId: string,
    apiKey: string,
  ): Promise<AgentConfig | null> {
    return this.agentConfigRepository.findOne({
      where: {
        agentId,
        apiKey,
      },
      relations: {
        agent: true,
      },
    });
  }

  async save(config: Partial<AgentConfig>): Promise<AgentConfig> {
    return this.agentConfigRepository.save(config);
  }
}
