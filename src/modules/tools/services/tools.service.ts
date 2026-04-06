import { Autowired, Service } from "fragment-ts";
import { RequestContextHolder } from "../../../common/context/request-context-holder";
import { defaultPlatformTools } from "../../../constants/default-platform-tools";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { AgentToolExecutionService } from "../../agent/services/agent-tool-execution.service";
import { keywordCatalog } from "../contracts/keyword-catalog.contract";
import { CreateAgentToolDto } from "../dto/create-agent-tool.dto";
import { TestAgentToolDto } from "../dto/test-agent-tool.dto";
import { UpdateAgentToolDto } from "../dto/update-agent-tool.dto";
import { AgentToolRepository } from "../repositories/agent-tool.repository";
import { PlatformToolRepository } from "../repositories/platform-tool.repository";
import { ToolMemoryService } from "./tool-memory.service";

@Service()
export class ToolsService {
  @Autowired()
  private platformToolRepository!: PlatformToolRepository;

  @Autowired()
  private agentToolRepository!: AgentToolRepository;

  @Autowired()
  private agentRepository!: AgentRepository;

  @Autowired()
  private agentToolExecutionService!: AgentToolExecutionService;

  @Autowired()
  private toolMemoryService!: ToolMemoryService;

  async listPlatformTools() {
    const tools = await this.platformToolRepository.listAll();

    return tools.map((tool) => {
      const definition = defaultPlatformTools[tool.key];

      return {
        ...tool,
        userEnabled: definition?.userEnabled ?? true,
        implemented: definition?.implemented ?? false,
        sampleCall: definition?.sampleCall ?? null,
        widget: definition?.widget ?? null,
        internal: true,
      };
    });
  }

  async listAgentTools(agentId: string) {
    return this.agentToolRepository.findByAgentId(agentId);
  }

  async createAgentTool(agentId: string, payload: CreateAgentToolDto) {
    const agent = await this.agentRepository.findById(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    return this.agentToolRepository.save({
      agentId,
      name: payload.name.trim(),
      description: payload.description?.trim() ?? null,
      schema: payload.schema ?? null,
      code: payload.code ?? null,
      enabled: payload.enabled ?? true,
      commitHash: payload.commitHash ?? null,
    });
  }

  async deleteAgentTool(agentToolId: string) {
    const existing = await this.agentToolRepository.findById(agentToolId);

    if (!existing) {
      throw new Error(`Agent tool ${agentToolId} not found.`);
    }

    await this.agentToolRepository.deleteById(agentToolId);
    return { id: agentToolId, deleted: true };
  }

  async updateAgentTool(agentToolId: string, payload: UpdateAgentToolDto) {
    const existing = await this.agentToolRepository.findById(agentToolId);

    if (!existing) {
      throw new Error(`Agent tool ${agentToolId} not found.`);
    }

    return this.agentToolRepository.save({
      ...existing,
      name: payload.name?.trim() ?? existing.name,
      description:
        payload.description === undefined
          ? existing.description
          : payload.description?.trim() ?? null,
      schema: payload.schema ?? existing.schema,
      code: payload.code === undefined ? existing.code : payload.code,
      enabled: payload.enabled ?? existing.enabled,
    });
  }

  async runTest(payload: TestAgentToolDto) {
    const agentToolId = payload.agentToolId ?? payload.tuulId;

    if (!agentToolId) {
      throw new Error("agentToolId is required.");
    }

    const tool = await this.agentToolRepository.findById(agentToolId);

    if (!tool) {
      throw new Error(`Agent tool ${agentToolId} not found.`);
    }

    const args = this.validateAndParseArgs(
      (tool.schema as Record<string, unknown> | null | undefined) ?? undefined,
      payload.args ?? {},
    );
    const context = RequestContextHolder.get();
    const agentId = payload.agentId ?? tool.agentId ?? context?.agentId;

    if (!agentId) {
      throw new Error("agentId is required to run a tool test.");
    }

    const output = await this.agentToolExecutionService.executeWithLogs(
      tool,
      args,
      {
        agentId,
        sessionId: payload.sessionId ?? context?.sessionId ?? `tool-test-${Date.now()}`,
      },
    );

    await this.agentToolRepository.save({
      ...tool,
      lastTestedAt: new Date(),
    });

    return output;
  }

  async getKeywords() {
    return keywordCatalog;
  }

  async getMemoryById(sharedMemoryId: string) {
    return this.toolMemoryService.getBySharedMemoryId(sharedMemoryId);
  }

  async updateMemory(sharedMemoryId: string, data: Record<string, unknown>) {
    return this.toolMemoryService.updateBySharedMemoryId(sharedMemoryId, data);
  }

  async clearMemory(sharedMemoryId: string) {
    return this.toolMemoryService.clearBySharedMemoryId(sharedMemoryId);
  }

  private validateAndParseArgs(
    schema: Record<string, unknown> | undefined,
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    const properties =
      schema?.properties && typeof schema.properties === "object"
        ? (schema.properties as Record<string, { type?: string }>)
        : {};
    const required = Array.isArray(schema?.required)
      ? (schema.required as string[])
      : [];
    const parsedArgs: Record<string, unknown> = {};

    for (const [name, definition] of Object.entries(properties)) {
      const rawValue = args[name];

      if (
        (rawValue === undefined || rawValue === null || rawValue === "") &&
        required.includes(name)
      ) {
        throw new Error(`Argument "${name}" is required.`);
      }

      if (rawValue === undefined || rawValue === null || rawValue === "") {
        continue;
      }

      parsedArgs[name] = this.coerceArgValue(name, rawValue, definition?.type);
    }

    for (const [name, value] of Object.entries(args)) {
      if (!(name in parsedArgs)) {
        parsedArgs[name] = value;
      }
    }

    return parsedArgs;
  }

  private coerceArgValue(
    name: string,
    value: unknown,
    type: string | undefined,
  ): unknown {
    switch ((type ?? "").toLowerCase()) {
      case "number":
      case "float":
      case "integer": {
        if (typeof value === "number") {
          return value;
        }

        const parsed = Number(value);

        if (Number.isNaN(parsed)) {
          throw new Error(`Argument "${name}" must be a valid number.`);
        }

        return parsed;
      }

      case "boolean":
        if (typeof value === "boolean") {
          return value;
        }

        if (value === "true") {
          return true;
        }

        if (value === "false") {
          return false;
        }

        throw new Error(`Argument "${name}" must be true or false.`);

      case "array":
      case "object":
        if (typeof value === "object") {
          return value;
        }

        if (typeof value === "string") {
          try {
            return JSON.parse(value);
          } catch {
            throw new Error(`Argument "${name}" must be valid JSON.`);
          }
        }

        throw new Error(`Argument "${name}" must be valid ${type}.`);

      default:
        return value;
    }
  }
}
