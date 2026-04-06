import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { AgentInstance } from "../../../entities/agent-instance.entity";

@FragmentRepository()
export class AgentInstanceRepository {
  @InjectRepository(AgentInstance)
  private agentInstanceRepository!: Repository<AgentInstance>;

  async findByAgentId(agentId: string): Promise<AgentInstance[]> {
    return this.agentInstanceRepository.find({
      where: { agentId },
      relations: {
        versionEntries: true,
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findByBranchName(
    agentId: string,
    branchName: string,
  ): Promise<AgentInstance | null> {
    return this.agentInstanceRepository
      .createQueryBuilder("instance")
      .where("instance.agent_id = :agentId", { agentId })
      .andWhere("JSON_UNQUOTE(JSON_EXTRACT(instance.version, '$.gitBranch')) = :branchName", {
        branchName,
      })
      .getOne();
  }

  async findById(instanceId: string): Promise<AgentInstance | null> {
    return this.agentInstanceRepository.findOne({
      where: { id: instanceId },
      relations: {
        versionEntries: true,
      },
    });
  }

  async save(input: Partial<AgentInstance>): Promise<AgentInstance> {
    return this.agentInstanceRepository.save(input);
  }

  async deleteById(instanceId: string): Promise<void> {
    await this.agentInstanceRepository.delete(instanceId);
  }

  async findCurrentByAgent(
    agentId: string,
    reference?: AgentInstance["reference"] | null,
  ): Promise<AgentInstance[]> {
    const query = this.agentInstanceRepository
      .createQueryBuilder("instance")
      .where("instance.agent_id = :agentId", { agentId })
      .andWhere("instance.projection = :projection", { projection: "current" });

    if (reference === undefined) {
      return query.getMany();
    }

    if (reference === null) {
      query.andWhere("instance.reference IS NULL");
      return query.getMany();
    }

    query.andWhere("instance.reference = :reference", { reference });
    return query.getMany();
  }
}
