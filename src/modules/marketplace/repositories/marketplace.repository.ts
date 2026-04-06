import { FragmentRepository, InjectRepository, Repository } from "fragment-ts";
import { Agent } from "../../../entities/agent.entity";
import { AgentInstance } from "../../../entities/agent-instance.entity";
import { AgentParameter } from "../../../entities/agent-parameter.entity";
import { AgentStatus } from "../../../entities/enums/agent-status.enum";
import { InstanceProjection } from "../../../entities/enums/instance-projection.enum";

@FragmentRepository()
export class MarketplaceRepository {
  @InjectRepository(Agent)
  private agentRepository!: Repository<Agent>;

  @InjectRepository(AgentInstance)
  private instanceRepository!: Repository<AgentInstance>;

  @InjectRepository(AgentParameter)
  private parameterRepository!: Repository<AgentParameter>;

  async listPublicAgents(): Promise<Agent[]> {
    return this.agentRepository.find({
      where: {
        status: AgentStatus.ACTIVE,
      },
      relations: {
        organization: true,
        instances: true,
        parameters: true,
      },
      order: {
        updatedAt: "DESC",
      },
    });
  }

  async findPublicAgentBySlug(slug: string): Promise<Agent | null> {
    return this.agentRepository.findOne({
      where: {
        slug,
        status: AgentStatus.ACTIVE,
      },
      relations: {
        organization: true,
        instances: true,
        parameters: true,
      },
    });
  }

  async findPublicAgentById(agentId: string): Promise<Agent | null> {
    return this.agentRepository.findOne({
      where: {
        id: agentId,
        status: AgentStatus.ACTIVE,
      },
      relations: {
        organization: true,
      },
    });
  }

  async findPublicInstances(agentId: string): Promise<AgentInstance[]> {
    return this.instanceRepository.find({
      where: {
        agentId,
        projection: InstanceProjection.CURRENT,
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findParameterByCommitHash(agentId: string, commitHash?: string | null) {
    if (!commitHash) return null;
    return this.parameterRepository.findOne({
      where: { agentId, commitHash },
      order: { createdAt: "DESC" },
    });
  }
}
