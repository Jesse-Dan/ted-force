import {
  FragmentRepository,
  InjectRepository,
  IsNull,
  Repository,
} from "fragment-ts";
import { AgentTool } from "../../../entities/agent-tool.entity";

@FragmentRepository()
export class AgentToolRepository {
  @InjectRepository(AgentTool)
  private agentToolRepository!: Repository<AgentTool>;

  async findByAgentId(agentId: string): Promise<AgentTool[]> {
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

  async findEnabledByAgentId(agentId: string): Promise<AgentTool[]> {
    return this.agentToolRepository.find({
      where: {
        agentId,
        enabled: true,
        commitHash: IsNull(),
      },
      order: {
        createdAt: "ASC",
      },
    });
  }

  async save(agentTool: Partial<AgentTool>): Promise<AgentTool> {
    return this.agentToolRepository.save(agentTool);
  }

  async findById(agentToolId: string): Promise<AgentTool | null> {
    return this.agentToolRepository.findOne({
      where: { id: agentToolId },
    });
  }

  async deleteById(agentToolId: string): Promise<void> {
    await this.agentToolRepository.delete(agentToolId);
  }

  async deleteByAgentId(agentId: string): Promise<void> {
    await this.agentToolRepository.delete({ agentId });
  }

  async findKeywordCandidates(): Promise<string[]> {
    const tools = await this.agentToolRepository.find({
      order: {
        createdAt: "DESC",
      },
      take: 200,
    });

    return tools.flatMap((tool) =>
      `${tool.name} ${tool.description ?? ""}`
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter((keyword) => keyword.length > 3),
    );
  }
}
