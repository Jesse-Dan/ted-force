import {
  FragmentRepository,
  InjectRepository,
  IsNull,
  Repository,
} from "fragment-ts";
import { AgentTool } from "../../../entities/agent-tool.entity";

@FragmentRepository()
export class AgentToolVersionRepository {
  @InjectRepository(AgentTool)
  private agentToolRepository!: Repository<AgentTool>;

  async findLiveByAgentId(agentId: string): Promise<AgentTool[]> {
    return this.agentToolRepository.find({
      where: {
        agentId,
        commitHash: IsNull(),
      },
      order: {
        createdAt: "ASC",
      },
    });
  }

  async findByCommitHash(agentId: string, commitHash: string): Promise<AgentTool[]> {
    return this.agentToolRepository.find({
      where: {
        agentId,
        commitHash,
      },
      order: {
        createdAt: "ASC",
      },
    });
  }

  async saveMany(input: Partial<AgentTool>[]): Promise<AgentTool[]> {
    return this.agentToolRepository.save(input);
  }

  async deleteLiveByAgentId(agentId: string): Promise<void> {
    await this.agentToolRepository.delete({
      agentId,
      commitHash: IsNull(),
    });
  }
}
