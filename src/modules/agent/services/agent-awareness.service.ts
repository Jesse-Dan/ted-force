import { InjectRepository, Repository, Service } from "fragment-ts";
import { AwarenessRecord } from "../../../entities/awareness-record.entity";

@Service()
export class AgentAwarenessService {
  @InjectRepository(AwarenessRecord)
  private awarenessRepository!: Repository<AwarenessRecord>;

  async getContext(agentId: string, sessionId?: string | null) {
    if (!sessionId) {
      return { success: false, context: [] as string[] };
    }

    const record = await this.findRecord(agentId, sessionId);

    return {
      success: true,
      context: record?.context ?? [],
    };
  }

  async updateContext(
    agentId: string,
    sessionId: string | null | undefined,
    context: string[],
  ) {
    if (!sessionId) {
      return { success: false, feedback: "Missing session ID" };
    }

    const record = await this.getOrCreateRecord(agentId, sessionId);
    record.context = this.normalizeContext(context);
    record.used = (record.used ?? 0) + 1;

    const saved = await this.awarenessRepository.save(record);

    return {
      success: true,
      context: saved.context ?? [],
    };
  }

  async clearContext(agentId: string, sessionId?: string | null) {
    if (!sessionId) {
      return { success: false, feedback: "Missing session ID" };
    }

    const record = await this.getOrCreateRecord(agentId, sessionId);
    record.context = [];
    record.used = (record.used ?? 0) + 1;

    const saved = await this.awarenessRepository.save(record);

    return {
      success: true,
      context: saved.context ?? [],
    };
  }

  async loadContextLines(
    agentId: string,
    sessionId?: string | null,
  ): Promise<string[]> {
    if (!sessionId) {
      return [];
    }

    const record = await this.findRecord(agentId, sessionId);
    return record?.context ?? [];
  }

  private async findRecord(agentId: string, sessionId: string) {
    return this.awarenessRepository.findOne({
      where: {
        agentId,
        sessionId,
      },
    });
  }

  private async getOrCreateRecord(agentId: string, sessionId: string) {
    const existing = await this.findRecord(agentId, sessionId);

    if (existing) {
      existing.context = existing.context ?? [];
      return existing;
    }

    return this.awarenessRepository.create({
      agentId,
      sessionId,
      used: 1,
      context: [],
    });
  }

  private normalizeContext(context: string[]): string[] {
    return (Array.isArray(context) ? context : [])
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
  }
}
