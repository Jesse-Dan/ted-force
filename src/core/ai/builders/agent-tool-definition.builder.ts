import type { JSONSchema7 } from "ai";
import type { AgentTool } from "../../../entities/agent-tool.entity";
import type { CapabilityProfile } from "../../../entities/capability-profile.entity";
import type { PlatformTool } from "../../../entities/platform-tool.entity";
import type { ToolDefinition } from "./tool-bundle.builder";

function normalizeSchema(schema?: Record<string, unknown> | null): JSONSchema7 {
  return (schema as JSONSchema7 | undefined) ?? {
    type: "object",
    properties: {},
    additionalProperties: false,
  };
}

function slugifyToolName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export class AgentToolDefinitionBuilder {
  buildFromPlatformTools({
    capabilityProfile,
    platformTools = [],
  }: {
    capabilityProfile?: CapabilityProfile | null;
    platformTools?: PlatformTool[];
  }): ToolDefinition[] {
    const toolUseEnabled = capabilityProfile?.capabilityFlags?.toolUse ?? true;
    const functionCallingEnabled =
      capabilityProfile?.capabilityFlags?.functionCalling ?? true;

    if (!toolUseEnabled || !functionCallingEnabled) {
      return [];
    }

    const enabledToolIds = new Set(
      (capabilityProfile?.toolPolicies ?? [])
        .filter((policy) => policy.userEnabled)
        .map((policy) => policy.platformToolId),
    );

    return platformTools
      .filter((platformTool) => platformTool.systemEnabled)
      .filter((platformTool) =>
        enabledToolIds.size === 0 ? true : enabledToolIds.has(platformTool.id),
      )
      .map((platformTool) => ({
        name: platformTool.key,
        description:
          platformTool.description ??
          `Platform tool ${platformTool.name} is available for this agent.`,
        inputSchema: this.platformToolArgsToSchema(platformTool),
        execute: async (input) => ({
          toolType: "platform",
          toolKey: platformTool.key,
          toolName: platformTool.name,
          approved: true,
          input,
          status: "not_implemented",
          message:
            "Platform tool execution has not been wired yet in v2. The tool is bundled and visible to the model.",
        }),
      }));
  }

  buildFromAgentTools(agentTools: AgentTool[] = []): ToolDefinition[] {
    return agentTools
      .filter((agentTool) => agentTool.enabled)
      .map((agentTool) => ({
        name: slugifyToolName(agentTool.name),
        description:
          agentTool.description ??
          `Agent tool ${agentTool.name} is available for this runtime.`,
        inputSchema: normalizeSchema(agentTool.schema),
        execute: async (input) => ({
          toolType: "agent",
          toolName: agentTool.name,
          toolId: agentTool.id,
          input,
          status: "not_implemented",
          message:
            "Agent tool execution has not been wired yet in v2. The tool is bundled and visible to the model.",
        }),
      }));
  }

  private platformToolArgsToSchema(platformTool: PlatformTool): JSONSchema7 {
    const properties: Record<string, JSONSchema7> = {};
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

  private toJsonSchemaType(type: string): JSONSchema7["type"] {
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
