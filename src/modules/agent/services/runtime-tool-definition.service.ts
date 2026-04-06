import { Service, Autowired } from "fragment-ts";
import type { ToolDefinition } from "../../../core/ai/builders/tool-bundle.builder";
import type { AgentTool } from "../../../entities/agent-tool.entity";
import type { CapabilityProfile } from "../../../entities/capability-profile.entity";
import type { PlatformTool } from "../../../entities/platform-tool.entity";
import { FirebaseViewLogService } from "../../../core/logging/services/firebase-view-log.service";
import { AgentToolExecutionService } from "./agent-tool-execution.service";
import { PlatformToolExecutionService } from "./platform-tool-execution.service";

function normalizeToolName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

@Service()
export class RuntimeToolDefinitionService {
  @Autowired()
  private platformToolExecution!: PlatformToolExecutionService;

  @Autowired()
  private agentToolExecution!: AgentToolExecutionService;

  @Autowired()
  private firebaseViewLog!: FirebaseViewLogService;

  buildDefinitions(input: {
    agentId: string;
    sessionId: string;
    commitHash?: string;
    instanceId?: string;
    capabilityProfile?: CapabilityProfile | null;
    platformTools?: PlatformTool[];
    agentTools?: AgentTool[];
    webSearch?: boolean;
  }): ToolDefinition[] {
    return [
      ...this.buildPlatformTools(input),
      ...this.buildAgentTools(input),
    ];
  }

  private buildPlatformTools(input: {
    agentId: string;
    sessionId: string;
    capabilityProfile?: CapabilityProfile | null;
    platformTools?: PlatformTool[];
    webSearch?: boolean;
  }): ToolDefinition[] {
    const toolUseEnabled = input.capabilityProfile?.capabilityFlags?.toolUse ?? true;
    const functionCallingEnabled =
      input.capabilityProfile?.capabilityFlags?.functionCalling ?? true;

    if (!toolUseEnabled || !functionCallingEnabled) {
      return [];
    }

    const enabledToolIds = new Set(
      (input.capabilityProfile?.toolPolicies ?? [])
        .filter((policy) => policy.userEnabled)
        .map((policy) => policy.platformToolId),
    );

    return (input.platformTools ?? [])
      .filter((platformTool) => platformTool.systemEnabled)
      .filter((platformTool) =>
        platformTool.key === "web_search" && input.webSearch === false ? false : true,
      )
      .filter((platformTool) =>
        enabledToolIds.size === 0 ? true : enabledToolIds.has(platformTool.id),
      )
      .map((platformTool) => ({
        name: platformTool.key,
        description:
          platformTool.description ?? `Platform tool ${platformTool.name}`,
        inputSchema: this.platformToolSchema(platformTool),
        execute: async (args) => {
          await this.firebaseViewLog.graph(
            input.agentId,
            input.sessionId,
            `Bundled platform tool selected: ${platformTool.key}`,
            { toolId: platformTool.id },
          );

          return this.platformToolExecution.execute(
            platformTool,
            this.normalizeArgs(args),
            {
              agentId: input.agentId,
              sessionId: input.sessionId,
            },
          );
        },
      }));
  }

  private buildAgentTools(input: {
    agentId: string;
    sessionId: string;
    commitHash?: string;
    instanceId?: string;
    agentTools?: AgentTool[];
  }): ToolDefinition[] {
    return (input.agentTools ?? [])
      .filter((agentTool) => agentTool.enabled)
      .map((agentTool) => ({
        name: normalizeToolName(agentTool.name),
        description: agentTool.description ?? `Agent tool ${agentTool.name}`,
        inputSchema: (agentTool.schema as any) ?? {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async (args) => {
          await this.firebaseViewLog.graph(
            input.agentId,
            input.sessionId,
            `Bundled agent tool selected: ${agentTool.name}`,
            { toolId: agentTool.id },
          );

          return this.agentToolExecution.execute(agentTool, this.normalizeArgs(args), {
            agentId: input.agentId,
            sessionId: input.sessionId,
            commitHash: input.commitHash,
            instanceId: input.instanceId,
          });
        },
      }));
  }

  private normalizeArgs(args: unknown): Record<string, unknown> {
    if (args && typeof args === "object" && !Array.isArray(args)) {
      return args as Record<string, unknown>;
    }

    return {};
  }

  private platformToolSchema(platformTool: PlatformTool): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const arg of platformTool.args ?? []) {
      properties[arg.name] = {
        type: this.toJsonSchemaType(arg.type),
        description: arg.description,
      };
      required.push(arg.name);
    }

    return {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    };
  }

  private toJsonSchemaType(type: string): string {
    switch (type.toLowerCase()) {
      case "number":
      case "float":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "array":
        return "array";
      case "object":
        return "object";
      default:
        return "string";
    }
  }
}
