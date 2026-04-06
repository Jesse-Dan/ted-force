import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { AgentEnvironmentVariable } from "../../../entities/agent-environment-variable.entity";
import { ToolMemoryEntry } from "../../../entities/tool-memory-entry.entity";

@FragmentRepository()
export class AgentToolExecutionRepository {
  @InjectRepository(AgentEnvironmentVariable)
  private environmentVariableRepository!: Repository<AgentEnvironmentVariable>;

  @InjectRepository(ToolMemoryEntry)
  private toolMemoryRepository!: Repository<ToolMemoryEntry>;

  async getEnvironmentMap(agentId: string): Promise<Record<string, string>> {
    const envs = await this.environmentVariableRepository.find({
      where: { agentId },
    });

    return Object.fromEntries(envs.map((env) => [env.key, env.value]));
  }

  async getToolMemory(agentToolId: string): Promise<Record<string, unknown>> {
    const entries = await this.toolMemoryRepository.find({
      where: { agentToolId },
      order: { createdAt: "DESC" },
    });

    return entries[0]?.data ?? {};
  }

  async saveToolMemory(
    agentToolId: string,
    data: Record<string, unknown>,
    sharedMemoryId?: string,
  ): Promise<void> {
    await this.toolMemoryRepository.save({
      agentToolId,
      sharedMemoryId: sharedMemoryId ?? null,
      data,
    });
  }
}
