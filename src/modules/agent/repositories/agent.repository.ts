import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { Agent } from "../../../entities/agent.entity";

@FragmentRepository()
export class AgentRepository {
  @InjectRepository(Agent)
  private agentRepository!: Repository<Agent>;

  async list(filters?: {
    organizationId?: string;
    ownerUserId?: string;
  }): Promise<Agent[]> {
    return this.agentRepository.find({
      where: {
        ...(filters?.organizationId ? { organizationId: filters.organizationId } : {}),
        ...(filters?.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      },
      relations: {
        config: true,
        organization: true,
      },
      order: {
        updatedAt: "DESC",
      },
    });
  }

  async findById(agentId: string): Promise<Agent | null> {
    return this.agentRepository.findOne({
      where: { id: agentId },
      relations: {
        config: true,
        organization: true,
      },
    });
  }

  async findBySlug(slug: string): Promise<Agent | null> {
    return this.agentRepository.findOne({
      where: { slug },
    });
  }

  async save(agent: Partial<Agent>): Promise<Agent> {
    return this.agentRepository.save(agent);
  }

  async updateMetadata(agentId: string, metadata: Agent["metadata"]): Promise<Agent> {
    const existing = await this.findById(agentId);

    if (!existing) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    return this.agentRepository.save({
      ...existing,
      metadata,
    });
  }

  async deleteById(agentId: string): Promise<void> {
    await this.agentRepository.delete(agentId);
  }
}
