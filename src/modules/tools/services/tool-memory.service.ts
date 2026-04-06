import { Autowired, Service } from "fragment-ts";
import { AgentTool } from "../../../entities/agent-tool.entity";
import { ToolMemoryEntry } from "../../../entities/tool-memory-entry.entity";
import { AgentToolRepository } from "../repositories/agent-tool.repository";
import { ToolMemoryRepository } from "../repositories/tool-memory.repository";

@Service()
export class ToolMemoryService {
  @Autowired()
  private agentToolRepository!: AgentToolRepository;

  @Autowired()
  private toolMemoryRepository!: ToolMemoryRepository;

  async getEntryForTool(agentTool: AgentTool): Promise<ToolMemoryEntry> {
    const sharedMemoryId = agentTool.stateManagement?.sharedContextId?.trim() || null;

    const existing = sharedMemoryId
      ? await this.toolMemoryRepository.findByMemoryId(sharedMemoryId)
      : await this.toolMemoryRepository.findByAgentToolId(agentTool.id);

    if (existing) {
      return this.ensureNormalized(existing);
    }

    return this.toolMemoryRepository.save({
      agentToolId: agentTool.id,
      sharedMemoryId,
      data: {},
    });
  }

  async getDataForTool(agentTool: AgentTool): Promise<Record<string, unknown>> {
    const entry = await this.getEntryForTool(agentTool);
    const lifetimeSeconds = agentTool.stateManagement?.lifetimeSeconds;

    if (lifetimeSeconds && lifetimeSeconds > 0) {
      const referenceDate = entry.updatedAt ?? entry.createdAt;
      const ageSeconds = (Date.now() - referenceDate.getTime()) / 1000;

      if (ageSeconds > lifetimeSeconds) {
        const cleared = await this.toolMemoryRepository.save({
          ...entry,
          data: {},
        });

        return this.ensureNormalized(cleared).data ?? {};
      }
    }

    return entry.data ?? {};
  }

  async saveDataForTool(
    agentTool: AgentTool,
    data: Record<string, unknown>,
  ): Promise<ToolMemoryEntry> {
    const entry = await this.getEntryForTool(agentTool);

    return this.toolMemoryRepository.save({
      ...entry,
      data,
    });
  }

  async getBySharedMemoryId(sharedMemoryId: string): Promise<ToolMemoryEntry> {
    const entry = await this.resolveEntry(sharedMemoryId);

    if (!entry) {
      throw new Error(`Tool memory ${sharedMemoryId} not found.`);
    }

    return this.ensureNormalized(entry);
  }

  async updateBySharedMemoryId(
    sharedMemoryId: string,
    patch: Record<string, unknown>,
  ): Promise<ToolMemoryEntry> {
    const entry = await this.getBySharedMemoryId(sharedMemoryId);

    return this.toolMemoryRepository.save({
      ...entry,
      data: {
        ...(entry.data ?? {}),
        ...patch,
      },
    });
  }

  async clearBySharedMemoryId(sharedMemoryId: string): Promise<ToolMemoryEntry> {
    const entry = await this.getBySharedMemoryId(sharedMemoryId);

    return this.toolMemoryRepository.save({
      ...entry,
      data: {},
    });
  }

  private ensureNormalized(entry: ToolMemoryEntry): ToolMemoryEntry {
    entry.data = entry.data ?? {};
    return entry;
  }

  private async resolveEntry(identifier: string): Promise<ToolMemoryEntry | null> {
    const bySharedMemoryId = await this.toolMemoryRepository.findByMemoryId(identifier);
    if (bySharedMemoryId) {
      return this.ensureNormalized(bySharedMemoryId);
    }

    const byMemoryEntryId = await this.toolMemoryRepository.findById(identifier);
    if (byMemoryEntryId) {
      return this.ensureNormalized(byMemoryEntryId);
    }

    const byAgentToolId = await this.toolMemoryRepository.findByAgentToolId(identifier);
    if (byAgentToolId) {
      return this.ensureNormalized(byAgentToolId);
    }

    const agentTool = await this.agentToolRepository.findById(identifier);
    if (agentTool) {
      return this.getEntryForTool(agentTool);
    }

    return null;
  }
}
