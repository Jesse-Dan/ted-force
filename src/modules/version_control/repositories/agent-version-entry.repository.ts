import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { AgentVersionEntry } from "../../../entities/agent-version-entry.entity";

@FragmentRepository()
export class AgentVersionEntryRepository {
  @InjectRepository(AgentVersionEntry)
  private versionEntryRepository!: Repository<AgentVersionEntry>;

  async findOrphanedByAgentId(agentId: string): Promise<AgentVersionEntry[]> {
    // Legacy entries were persisted without `instance_id` but still include the agent id and branch id
    // inside `metadata.snapshot.agent.id` / `metadata.branch.id`. We self-heal these records on read.
    return this.versionEntryRepository
      .createQueryBuilder("entry")
      .where("entry.instance_id IS NULL")
      .andWhere(
        "JSON_UNQUOTE(JSON_EXTRACT(entry.metadata, '$.snapshot.agent.id')) = :agentId",
        { agentId },
      )
      .orderBy("entry.releasedAt", "DESC")
      .getMany();
  }

  async updateInstanceId(id: string, instanceId: string | null): Promise<void> {
    await this.versionEntryRepository.update({ id } as any, {
      instanceId,
    } as any);
  }

  async findByInstanceId(instanceId: string): Promise<AgentVersionEntry[]> {
    return this.versionEntryRepository.find({
      where: { instanceId },
      relations: {
        instance: true,
      },
      order: {
        releasedAt: "DESC",
      },
    });
  }

  async findByInstanceIdAsc(instanceId: string): Promise<AgentVersionEntry[]> {
    return this.versionEntryRepository.find({
      where: { instanceId },
      relations: {
        instance: true,
      },
      order: {
        releasedAt: "ASC",
      },
    });
  }

  async findByAgentId(agentId: string): Promise<AgentVersionEntry[]> {
    return this.versionEntryRepository
      .createQueryBuilder("entry")
      .leftJoinAndSelect("entry.instance", "instance")
      .where("instance.agent_id = :agentId", { agentId })
      .orderBy("entry.releasedAt", "DESC")
      .getMany();
  }

  async findByCommitHash(agentId: string, commitHash: string): Promise<AgentVersionEntry | null> {
    return this.versionEntryRepository
      .createQueryBuilder("entry")
      .leftJoinAndSelect("entry.instance", "instance")
      .where("entry.commit_hash = :commitHash", { commitHash })
      .andWhere("instance.agent_id = :agentId", { agentId })
      .getOne();
  }

  async findPreviousForInstance(
    instanceId: string,
    releasedAt: Date,
  ): Promise<AgentVersionEntry | null> {
    return this.versionEntryRepository
      .createQueryBuilder("entry")
      .leftJoinAndSelect("entry.instance", "instance")
      .where("entry.instance_id = :instanceId", { instanceId })
      .andWhere("entry.releasedAt < :releasedAt", { releasedAt })
      .orderBy("entry.releasedAt", "DESC")
      .getOne();
  }

  async save(input: Partial<AgentVersionEntry>): Promise<AgentVersionEntry> {
    return this.versionEntryRepository.save(input);
  }

  async findLatestForInstance(instanceId: string): Promise<AgentVersionEntry | null> {
    return this.versionEntryRepository.findOne({
      where: { instanceId },
      relations: {
        instance: true,
      },
      order: {
        releasedAt: "DESC",
      },
    });
  }

  async updateMetadata(
    id: string,
    metadata: AgentVersionEntry["metadata"],
  ): Promise<AgentVersionEntry> {
    const existing = await this.versionEntryRepository.findOne({
      where: { id },
      relations: {
        instance: true,
      },
    });

    if (!existing) {
      throw new Error(`Version entry ${id} not found.`);
    }

    return this.versionEntryRepository.save({
      ...existing,
      metadata,
    });
  }
}
