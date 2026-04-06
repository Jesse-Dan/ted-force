import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { In } from "typeorm";
import { AgentStatus } from "../../../entities/enums/agent-status.enum";
import { Agent } from "../../../entities/agent.entity";

@FragmentRepository()
export class PublicAgentRepository {
  @InjectRepository(Agent)
  private agentRepository!: Repository<Agent>;

  async findPublicBySlug(slug: string): Promise<Agent | null> {
    return this.agentRepository.findOne({
      where: {
        slug,
        status: In([AgentStatus.ACTIVE, AgentStatus.DEPLOYED]),
      },
      relations: {
        config: true,
        organization: true,
      },
    });
  }

  async listPublic(): Promise<Agent[]> {
    return this.agentRepository.find({
      where: {
        status: In([AgentStatus.ACTIVE, AgentStatus.DEPLOYED]),
      },
      order: {
        createdAt: "DESC",
      },
    });
  }
}
