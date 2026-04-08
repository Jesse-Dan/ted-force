import { Service, Autowired } from "fragment-ts";
import type { ToolDefinition } from "../../../core/ai/builders/tool-bundle.builder";
import type { AgentTool } from "../../../entities/agent-tool.entity";
import type { AgentConnector } from "../../../entities/agent-connector.entity";
import { ConnectorHttpMethod } from "../../../entities/enums/connector-http-method.enum";
import type { CapabilityProfile } from "../../../entities/capability-profile.entity";
import type { PlatformTool } from "../../../entities/platform-tool.entity";
import { FirebaseViewLogService } from "../../../core/logging/services/firebase-view-log.service";
import { AgentToolExecutionService } from "./agent-tool-execution.service";
import { PlatformToolExecutionService } from "./platform-tool-execution.service";
import { ConnectorRuntimeService } from "../../connectors/services/connector-runtime.service";

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

  @Autowired()
  private connectorRuntimeService!: ConnectorRuntimeService;

  buildDefinitions(input: {
    agentId: string;
    sessionId: string;
    commitHash?: string;
    instanceId?: string;
    capabilityProfile?: CapabilityProfile | null;
    platformTools?: PlatformTool[];
    agentTools?: AgentTool[];
    agentConnectors?: AgentConnector[];
    webSearch?: boolean;
  }): ToolDefinition[] {
    return [
      ...this.buildPlatformTools(input),
      ...this.buildConnectorTools(input),
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

  private buildConnectorTools(input: {
    agentId: string;
    sessionId: string;
    capabilityProfile?: CapabilityProfile | null;
    agentConnectors?: AgentConnector[];
  }): ToolDefinition[] {
    const toolUseEnabled = input.capabilityProfile?.capabilityFlags?.toolUse ?? true;
    const functionCallingEnabled =
      input.capabilityProfile?.capabilityFlags?.functionCalling ?? true;

    if (!toolUseEnabled || !functionCallingEnabled) {
      return [];
    }

    return (input.agentConnectors ?? [])
      .filter((connector) => connector.isLive || connector.enabled)
      .flatMap((connector) => {
        const operations = this.normalizeConnectorOperations(
          connector.operations as unknown,
        ).filter(
          (operation) =>
            operation.isExposed !== false &&
            operation.permissionLevel !== "never_allow",
        );

        return operations.map((operation) => ({
          name: this.normalizeConnectorToolName(
            connector.slug || connector.id,
            operation.id,
          ),
          description:
            operation.description ||
            connector.description ||
            `Connector operation ${operation.name}`,
          inputSchema: this.connectorRuntimeService.buildOperationSchema(operation),
          execute: async (args) => {
            await this.firebaseViewLog.graph(
              input.agentId,
              input.sessionId,
              `Connector platform tool selected: ${connector.name}`,
              {
                connectorId: connector.id,
                connectorSlug: connector.slug,
                operationId: operation.id,
              },
            );

            const output = await this.agentToolExecution.executeConnectorByReference(
              connector.id,
              this.normalizeArgs(args),
              {
                agentId: input.agentId,
                sessionId: input.sessionId,
              },
              {
                operationId: operation.id,
              },
            );
            return output.result;
          },
        }));
      });
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

  private normalizeConnectorToolName(connectorSlug: string, operationId: string): string {
    const connectorPart = normalizeToolName(connectorSlug || "connector");
    const operationPart = normalizeToolName(operationId || "operation");
    return `connector.${connectorPart}.${operationPart}`;
  }

  private normalizeConnectorOperations(raw: unknown): Array<{
    id: string;
    name: string;
    method: ConnectorHttpMethod;
    path: string;
    description: string;
    parameters: Array<{
      name: string;
      in: "query" | "path" | "header" | "body";
      type: string;
      description: string;
      required: boolean;
      enum?: string[];
      dependsOnParam?: string;
    }>;
    requestBodySchema?: Record<string, unknown> | null;
    isDestructive: boolean;
    isExposed: boolean;
    permissionLevel: "always_allow" | "needs_approval" | "never_allow";
  }> {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => entry as Record<string, unknown>)
      .map((entry) => ({
        id: String(entry.id ?? "").trim(),
        name: String(entry.name ?? entry.id ?? "").trim(),
        method: this.normalizeOperationMethod(entry.method),
        path: String(entry.path ?? entry.url ?? "/"),
        description:
          typeof entry.description === "string"
            ? entry.description
            : "Connector operation",
        parameters: Array.isArray(entry.parameters)
          ? (entry.parameters as any[])
              .filter((value) => value && typeof value === "object")
              .map((value) => ({
                name: String((value as any).name ?? ""),
                in: (["query", "path", "header", "body"].includes(
                  String((value as any).in ?? "").toLowerCase(),
                )
                  ? String((value as any).in).toLowerCase()
                  : "query") as "query" | "path" | "header" | "body",
                type: String((value as any).type ?? "string"),
                description: String(
                  (value as any).description ?? "Connector parameter",
                ),
                required: Boolean((value as any).required),
                enum: Array.isArray((value as any).enum)
                  ? ((value as any).enum as unknown[]).map((enumValue) =>
                      String(enumValue),
                    )
                  : undefined,
                dependsOnParam:
                  typeof (value as any).dependsOnParam === "string"
                    ? (value as any).dependsOnParam
                    : undefined,
              }))
          : [],
        requestBodySchema:
          entry.requestBodySchema &&
          typeof entry.requestBodySchema === "object" &&
          !Array.isArray(entry.requestBodySchema)
            ? (entry.requestBodySchema as Record<string, unknown>)
            : entry.bodySchema &&
                typeof entry.bodySchema === "object" &&
                !Array.isArray(entry.bodySchema)
              ? (entry.bodySchema as Record<string, unknown>)
              : undefined,
        isDestructive:
          entry.isDestructive === undefined
            ? this.normalizeOperationMethod(entry.method) !==
              ConnectorHttpMethod.GET
            : Boolean(entry.isDestructive),
        isExposed:
          entry.isExposed === undefined ? true : Boolean(entry.isExposed),
        permissionLevel:
          typeof entry.permissionLevel === "string"
            ? (["always_allow", "needs_approval", "never_allow"].includes(
                entry.permissionLevel,
              )
                ? (entry.permissionLevel as
                    | "always_allow"
                    | "needs_approval"
                    | "never_allow")
                : "always_allow")
            : "always_allow",
      }))
      .filter((entry) => entry.id.length > 0);
  }

  private normalizeOperationMethod(value: unknown): ConnectorHttpMethod {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (Object.values(ConnectorHttpMethod).includes(normalized as ConnectorHttpMethod)) {
      return normalized as ConnectorHttpMethod;
    }
    return ConnectorHttpMethod.POST;
  }
}
