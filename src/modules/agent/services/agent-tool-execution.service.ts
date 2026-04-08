import { Autowired, Service } from "fragment-ts";
import type { AgentTool } from "../../../entities/agent-tool.entity";
import { FirebaseViewLogService } from "../../../core/logging/services/firebase-view-log.service";
import { AgentToolExecutionRepository } from "../repositories/agent-tool-execution.repository";
import { PlatformToolExecutionService } from "./platform-tool-execution.service";
import { PlatformToolRepository } from "../../tools/repositories/platform-tool.repository";
import { AgentToolDataSourceExecutionService } from "./agent-tool-datasource-execution.service";
import { ToolMemoryService } from "../../tools/services/tool-memory.service";
import { AgentToolRepository } from "../../tools/repositories/agent-tool.repository";
import { AgentAwarenessService } from "./agent-awareness.service";
import { AgentRuntimeRepository } from "../repositories/agent-runtime.repository";
import { ConnectorRuntimeService } from "../../connectors/services/connector-runtime.service";
import { ConnectorHttpMethod } from "../../../entities/enums/connector-http-method.enum";

export interface AgentToolExecutionContext {
  agentId: string;
  sessionId: string;
  commitHash?: string;
  instanceId?: string;
}

export interface AgentToolExecutionLogEntry {
  type: "log" | "info" | "warn" | "error" | "debug";
  message: string;
  data?: unknown;
  line?: number;
  column?: number;
}

export interface AgentToolExecutionOutput {
  logs: AgentToolExecutionLogEntry[];
  result: unknown;
}

type ToolCodeExcerptLine = {
  lineNumber: number;
  content: string;
  highlight: boolean;
};

class ToolExecutionWrappedError extends Error {
  constructor(
    message: string,
    readonly meta: {
      kind:
        | "runtime"
        | "syntax"
        | "validation"
        | "network"
        | "http"
        | "function_call"
        | "awareness"
        | "platform";
      userMessage: string;
      suggestion?: string;
      item?: string;
      operation?: string;
      url?: string;
      status?: number;
      details?: unknown;
    },
  ) {
    super(message);
    this.name = "ToolExecutionWrappedError";
  }
}

@Service()
export class AgentToolExecutionService {
  private static readonly USER_CODE_LINE_OFFSET = 3;

  @Autowired()
  private executionRepository!: AgentToolExecutionRepository;

  @Autowired()
  private firebaseViewLog!: FirebaseViewLogService;

  @Autowired()
  private platformToolExecution!: PlatformToolExecutionService;

  @Autowired()
  private platformToolRepository!: PlatformToolRepository;

  @Autowired()
  private dataSourceExecution!: AgentToolDataSourceExecutionService;

  @Autowired()
  private toolMemoryService!: ToolMemoryService;

  @Autowired()
  private agentToolRepository!: AgentToolRepository;

  @Autowired()
  private agentAwarenessService!: AgentAwarenessService;

  @Autowired()
  private runtimeRepository!: AgentRuntimeRepository;

  @Autowired()
  private connectorRuntimeService!: ConnectorRuntimeService;

  async execute(
    agentTool: AgentTool,
    args: Record<string, unknown>,
    context: AgentToolExecutionContext,
  ): Promise<unknown> {
    const output = await this.executeWithLogs(agentTool, args, context);
    return output.result;
  }

  async executeWithLogs(
    agentTool: AgentTool,
    args: Record<string, unknown>,
    context: AgentToolExecutionContext,
  ): Promise<AgentToolExecutionOutput> {
    await this.firebaseViewLog.toolCall(
      context.agentId,
      context.sessionId,
      `Agent tool invoked: ${agentTool.name}`,
      {
        toolId: agentTool.id,
        args,
      },
    );

    const environment = await this.executionRepository.getEnvironmentMap(
      context.agentId,
    );
    const memory = agentTool.id
      ? await this.toolMemoryService.getDataForTool(agentTool)
      : {};
    const parameterSnapshot = await this.runtimeRepository.findAgentParameterSnapshot({
      agentId: context.agentId,
      commitHash: context.commitHash,
      instanceId: context.instanceId,
    });
    const persistentMemoryEnabled =
      parameterSnapshot?.contextRuleSet?.persistentMemory === true;

    const logs: AgentToolExecutionLogEntry[] = [];

    const persistMemory = async (nextMemory: Record<string, unknown>) => {
      if (!agentTool.id) {
        return;
      }

      await this.toolMemoryService.saveDataForTool(agentTool, nextMemory);
    };

    const recordLog = async (
      type: AgentToolExecutionLogEntry["type"],
      message: string,
      data?: unknown,
    ) => {
      logs.push({ type, message, data });

      await this.firebaseViewLog.executionLog(
        context.agentId,
        context.sessionId,
        message,
        data && typeof data === "object" ? (data as Record<string, unknown>) : undefined,
      );
    };

    const callPlatform = async (
      key: string,
      input: Record<string, unknown>,
    ): Promise<unknown> => {
      const platformTool = await this.platformToolRepository.findByKey(key);

      if (!platformTool?.systemEnabled) {
        throw new Error(`Platform tool ${key} is not available.`);
      }

      return this.platformToolExecution.execute(platformTool, input, context);
    };

    const awarenessDisabled = () => ({
      success: false,
      feedback:
        "Persistent memory is disabled for this agent. Enable context_rules/persistent_memory to use AWARENESS.",
      context: [] as string[],
    });

    const executor = {
      args,
      ENV: {
        get: (key: string) => environment[key] ?? null,
      },
      MEMORY: {
        get: (key: string) => {
          if (!(key in memory)) {
            throw new Error(`Key "${key}" not found in memory`);
          }

          return memory[key];
        },
        add: async (key: string, value: unknown) => {
          memory[key] = value;
          await persistMemory({ ...memory });
          return value;
        },
        set: async (key: string, value: unknown) => {
          memory[key] = value;
          await persistMemory({ ...memory });
          return value;
        },
        update: async (key: string, value: unknown) => {
          if (!(key in memory)) {
            throw new Error(`Key "${key}" not found to update.`);
          }

          const existingValue = memory[key];
          const mergedValue =
            this.isObject(existingValue) && this.isObject(value)
              ? { ...existingValue, ...value }
              : value;

          memory[key] = mergedValue;
          await persistMemory({ ...memory });
          return mergedValue;
        },
        remove: async (key: string) => {
          if (!(key in memory)) {
            throw new Error(`Key "${key}" not found in memory`);
          }

          delete memory[key];
          await persistMemory({ ...memory });
          return true;
        },
        clear: async () => {
          for (const key of Object.keys(memory)) {
            delete memory[key];
          }
          await persistMemory({});
          return true;
        },
        getOrCreate: async (key: string, initialValue: unknown) => {
          if (!(key in memory)) {
            memory[key] = initialValue;
            await persistMemory({ ...memory });
          }

          return memory[key];
        },
      },
      DATASOURCE: (reference: string) =>
        this.dataSourceExecution.create(context.agentId, reference),
      FUNCTION: {
        call: async (call: unknown) => {
          const nestedOutput = await this.executeNamedTool(
            agentTool,
            call,
            context,
          );

          logs.push(
            ...nestedOutput.logs.map((entry) => ({
              ...entry,
              message: `[FUNCTION.call] ${entry.message}`,
            })),
          );

          return nestedOutput.result;
        },
      },
      AWARENESS: {
        getContext: async () =>
          persistentMemoryEnabled
            ? this.agentAwarenessService.getContext(
                context.agentId,
                context.sessionId,
              )
            : awarenessDisabled(),
        updateContext: async (nextContext: unknown) =>
          persistentMemoryEnabled
            ? this.agentAwarenessService.updateContext(
                context.agentId,
                context.sessionId,
                this.normalizeAwarenessContext(nextContext),
              )
            : awarenessDisabled(),
        clearContext: async () =>
          persistentMemoryEnabled
            ? this.agentAwarenessService.clearContext(
                context.agentId,
                context.sessionId,
              )
            : awarenessDisabled(),
      },
      PLATFORM: {
        web_search: async (input: unknown) =>
          callPlatform("web_search", this.normalizePlatformInput(input, "query")),
        fact_check: async (input: unknown) =>
          callPlatform("fact_check", this.normalizePlatformInput(input, "claim")),
        code_run: async (input: unknown) =>
          callPlatform("code_run", this.normalizeObjectInput(input)),
        file_parse: async (input: unknown) =>
          callPlatform("file_parse", this.normalizeObjectInput(input)),
        translate: async (input: unknown) =>
          callPlatform("translate", this.normalizeObjectInput(input)),
        summarize: async (input: unknown) =>
          callPlatform("summarize", this.normalizeObjectInput(input)),
        analyze_sentiment: async (input: unknown) =>
          callPlatform("analyze_sentiment", this.normalizeObjectInput(input, "text")),
        web_scrape: async (input: unknown) =>
          callPlatform("web_scrape", this.normalizeObjectInput(input, "url")),
        generate_image: async (input: unknown) =>
          callPlatform("generate_image", this.normalizeObjectInput(input, "prompt")),
        speech_to_text: async (input: unknown) =>
          callPlatform("speech_to_text", this.normalizeObjectInput(input)),
        text_to_speech: async (input: unknown) =>
          callPlatform("text_to_speech", this.normalizeObjectInput(input, "text")),
        connector: async (input: unknown) => {
          const normalizedCall = this.normalizeConnectorCall(input);
          const nestedOutput = await this.executeConnectorByReference(
            normalizedCall.connectorReference,
            normalizedCall.arguments,
            context,
            {
              currentTool: agentTool,
              method: normalizedCall.method,
              operationId: normalizedCall.operationId,
            },
          );

          logs.push(
            ...nestedOutput.logs.map((entry) => ({
              ...entry,
              message: `[PLATFORM.connector] ${entry.message}`,
            })),
          );

          return nestedOutput.result;
        },
      },
      LOG: {
        log: async (message: string, data?: unknown) =>
          recordLog("log", String(message), data),
        info: async (message: string, data?: unknown) =>
          recordLog("info", String(message), data),
        warn: async (message: string, data?: unknown) =>
          recordLog("warn", String(message), data),
        error: async (message: string, data?: unknown) =>
          recordLog("error", String(message), data),
        debug: async (message: string, data?: unknown) =>
          recordLog("debug", String(message), data),
        getLogs: () => logs,
      },
      HTTP: {
        get: async (
          url: string,
          init?: RequestInit & { params?: Record<string, unknown> },
        ) => {
          const finalUrl = this.appendQuery(url, init?.params);
          const response = await this.fetchWithContext(finalUrl, {
            method: "GET",
            ...init,
          });
          return this.parseHttpResponse(response, { method: "GET", url: finalUrl });
        },
        post: async (url: string, body?: unknown, init?: RequestInit) => {
          const response = await this.fetchWithContext(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(init?.headers ?? {}),
            },
            ...init,
            body: body === undefined ? undefined : JSON.stringify(body),
          });
          return this.parseHttpResponse(response, { method: "POST", url });
        },
        put: async (url: string, body?: unknown, init?: RequestInit) => {
          const response = await this.fetchWithContext(url, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(init?.headers ?? {}),
            },
            ...init,
            body: body === undefined ? undefined : JSON.stringify(body),
          });
          return this.parseHttpResponse(response, { method: "PUT", url });
        },
        delete: async (url: string, init?: RequestInit) => {
          const response = await this.fetchWithContext(url, {
            method: "DELETE",
            ...init,
          });
          return this.parseHttpResponse(response, { method: "DELETE", url });
        },
      },
    };

    if (!agentTool.code?.trim()) {
      throw new Error(`Agent tool ${agentTool.name} has no code.`);
    }

    try {
      const script = new Function(
        "executor",
        this.buildExecutionScript(agentTool.code),
      );
      const result = await script(executor);

      await this.firebaseViewLog.task(
        context.agentId,
        context.sessionId,
        `Agent tool completed: ${agentTool.name}`,
        {
          toolId: agentTool.id,
          logs,
        },
      );

      return {
        logs,
        result,
      };
    } catch (error) {
      const details = this.formatExecutionError(error, agentTool.code);
      logs.push({
        type: "error",
        message: `Agent tool failed: ${agentTool.name}`,
        data: {
          userMessage: details.userMessage,
          error: details.message,
          kind: details.kind,
          suggestion: details.suggestion,
          failingItem: details.item,
          operation: details.operation,
          status: details.status,
          url: details.url,
          debug: details.debug,
        },
        line: details.line,
        column: details.column,
      });

      await this.firebaseViewLog.executionLog(
        context.agentId,
        context.sessionId,
        `Agent tool failed: ${agentTool.name}`,
        {
          error: details.userMessage,
          kind: details.kind,
          suggestion: details.suggestion,
          operation: details.operation,
          failingItem: details.item,
          line: details.line,
          column: details.column,
        },
      );

      return {
        logs,
        result: {
          success: false,
          error: details.message,
          userMessage: details.userMessage,
          suggestion: details.suggestion,
          failingItem: details.item,
          operation: details.operation,
          status: details.status,
          url: details.url,
          kind: details.kind,
        },
      };
    }
  }

  async executeConnectorByReference(
    connectorReference: string,
    args: Record<string, unknown>,
    context: AgentToolExecutionContext,
    options?: {
      currentTool?: AgentTool | null;
      method?: ConnectorHttpMethod;
      allowDisabled?: boolean;
      operationId?: string;
    },
  ): Promise<AgentToolExecutionOutput> {
    const operationId = options?.operationId ?? this.readConnectorOperationId(args);
    const cleanedArgs = this.stripConnectorEnvelope(args);
    const nested = await this.connectorRuntimeService.executeOperationByReference({
      agentId: context.agentId,
      connectorReference,
      operationId,
      parameters: cleanedArgs,
      sessionId: context.sessionId,
      requireLive: options?.allowDisabled ? false : true,
    });

    if (options?.method && nested.operation.method !== options.method) {
      throw new ToolExecutionWrappedError(
        `Connector method mismatch: expected ${options.method}, resolved ${nested.operation.method}.`,
        {
          kind: "validation",
          userMessage:
            `Connector method mismatch. Expected ${options.method} but resolved ${nested.operation.method}.`,
          operation: "PLATFORM.connector",
        },
      );
    }

    return {
      logs: [
        {
          type: "info",
          message: `Connector "${nested.connector.name}" executed.`,
          data: {
            connectorId: nested.connector.id,
            connectorSlug: nested.connector.slug,
            sourceType: nested.connector.source,
            operationId: nested.operation.id,
          },
        },
      ],
      result: {
        connector: {
          id: nested.connector.id,
          name: nested.connector.name,
          slug: nested.connector.slug,
          source: nested.connector.source,
        },
        operation: {
          id: nested.operation.id,
          name: nested.operation.name,
          method: nested.operation.method,
        },
        args: cleanedArgs,
        response: nested.response,
        observability: nested.observability,
      },
    };
  }

  private normalizeObjectInput(
    input: unknown,
    fallbackKey?: string,
  ): Record<string, unknown> {
    if (input && typeof input === "object" && !Array.isArray(input)) {
      return input as Record<string, unknown>;
    }

    if (fallbackKey && input !== undefined) {
      return { [fallbackKey]: input };
    }

    return {};
  }

  private async executeNamedTool(
    currentTool: AgentTool,
    call: unknown,
    context: AgentToolExecutionContext,
  ): Promise<AgentToolExecutionOutput> {
    const normalizedCall = this.normalizeFunctionCall(call);
    const agentTools = await this.agentToolRepository.findEnabledByAgentId(
      context.agentId,
    );
    const targetTool = agentTools.find((tool) =>
      this.matchesToolName(tool.name, normalizedCall.name),
    );

    if (!targetTool) {
      throw new ToolExecutionWrappedError(
        `Tool "${normalizedCall.name}" is not available in this agent.`,
        {
          kind: "function_call",
          userMessage: `FUNCTION.call could not find a tool named "${normalizedCall.name}".`,
          item: normalizedCall.name,
          operation: "FUNCTION.call",
        },
      );
    }

    if (targetTool.id === currentTool.id) {
      throw new ToolExecutionWrappedError(
        "FUNCTION.call cannot invoke the currently executing tool.",
        {
          kind: "function_call",
          userMessage:
            "FUNCTION.call cannot invoke the tool that is already running.",
          item: currentTool.name,
          operation: "FUNCTION.call",
        },
      );
    }

    const validatedArgs = this.validateAndParseArgs(
      (targetTool.schema as Record<string, unknown> | null | undefined) ?? undefined,
      normalizedCall.arguments,
    );

    return this.executeWithLogs(targetTool, validatedArgs, context);
  }

  private normalizeFunctionCall(call: unknown): {
    name: string;
    arguments: Record<string, unknown>;
  } {
    if (!call || typeof call !== "object" || Array.isArray(call)) {
      throw new ToolExecutionWrappedError(
        "FUNCTION.call requires an object payload.",
        {
          kind: "validation",
          userMessage:
            "FUNCTION.call expects an object like { name: 'tool_name', arguments: {} }.",
          operation: "FUNCTION.call",
        },
      );
    }

    const rawName = (call as Record<string, unknown>).name;
    const rawArgs = (call as Record<string, unknown>).arguments;

    if (typeof rawName !== "string" || !rawName.trim()) {
      throw new ToolExecutionWrappedError(
        "FUNCTION.call requires a valid tool name.",
        {
          kind: "validation",
          userMessage: "FUNCTION.call requires a non-empty tool name.",
          operation: "FUNCTION.call",
        },
      );
    }

    return {
      name: rawName.trim(),
      arguments:
        rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)
          ? (rawArgs as Record<string, unknown>)
          : {},
    };
  }

  private normalizeConnectorCall(call: unknown): {
    connectorReference: string;
    arguments: Record<string, unknown>;
    operationId?: string;
    method?: ConnectorHttpMethod;
  } {
    if (typeof call === "string" && call.trim()) {
      return {
        connectorReference: call.trim(),
        arguments: {},
      };
    }

    if (!call || typeof call !== "object" || Array.isArray(call)) {
      throw new ToolExecutionWrappedError(
        "PLATFORM.connector requires an object payload.",
        {
          kind: "validation",
          userMessage:
            "PLATFORM.connector expects an object like { connector: 'slug', arguments: {} }.",
          operation: "PLATFORM.connector",
        },
      );
    }

    const payload = call as Record<string, unknown>;
    const connectorReference = String(
      payload.connector ??
        payload.connectorId ??
        payload.connectorSlug ??
        payload.name ??
        payload.id ??
        payload.slug ??
        "",
    ).trim();

    if (!connectorReference) {
      throw new ToolExecutionWrappedError(
        "PLATFORM.connector requires a connector reference.",
        {
          kind: "validation",
          userMessage:
            "Provide a connector reference in connector/connectorId/connectorSlug/name.",
          operation: "PLATFORM.connector",
        },
      );
    }

    const rawMethod = payload.method;
    const parsedMethod =
      typeof rawMethod === "string" ? this.parseConnectorMethod(rawMethod) : undefined;
    const rawOperationId =
      payload.operation_id ??
      payload.operationId ??
      payload.operation ??
      payload.endpoint ??
      payload.endpointId;
    const operationId =
      typeof rawOperationId === "string" && rawOperationId.trim()
        ? rawOperationId.trim()
        : undefined;

    const argCandidates = [payload.arguments, payload.args, payload.payload, payload.input];
    let args =
      argCandidates.find((entry) => this.isObject(entry)) as
        | Record<string, unknown>
        | undefined;

    const hasEnvelope =
      this.isObject(payload.body) ||
      this.isObject(payload.query) ||
      this.isObject(payload.params) ||
      this.isObject(payload.path);

    if (!args && hasEnvelope) {
      args = {
        body: this.isObject(payload.body) ? payload.body : {},
        query: this.isObject(payload.query) ? payload.query : {},
        params: this.isObject(payload.params)
          ? payload.params
          : this.isObject(payload.path)
            ? payload.path
            : {},
      };
    }

    if (!args) {
      args = Object.entries(payload).reduce<Record<string, unknown>>(
        (accumulator, [key, value]) => {
          if (
            [
              "connector",
              "connectorId",
              "connectorSlug",
              "name",
              "id",
              "slug",
              "method",
              "arguments",
              "args",
              "payload",
              "input",
              "body",
              "query",
              "params",
              "path",
            ].includes(key)
          ) {
            return accumulator;
          }
          accumulator[key] = value;
          return accumulator;
        },
        {},
      );
    }

    return {
      connectorReference,
      arguments: args,
      operationId,
      method: parsedMethod,
    };
  }

  private parseConnectorMethod(input: string): ConnectorHttpMethod {
    const normalized = input.trim().toUpperCase();
    if (Object.values(ConnectorHttpMethod).includes(normalized as ConnectorHttpMethod)) {
      return normalized as ConnectorHttpMethod;
    }

    throw new ToolExecutionWrappedError(
      `Unsupported connector method "${input}".`,
      {
        kind: "validation",
        userMessage:
          `Invalid connector method "${input}". Use GET, POST, PUT, PATCH, or DELETE.`,
        operation: "PLATFORM.connector",
      },
    );
  }

  private readConnectorOperationId(args: Record<string, unknown>): string | undefined {
    const raw =
      args.operation_id ??
      args.operationId ??
      args.operation ??
      args.endpoint ??
      args.endpointId;
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
    return undefined;
  }

  private stripConnectorEnvelope(
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    const nestedKey = ["parameters", "args", "payload", "input"].find((key) =>
      this.isObject(args[key]),
    );
    if (nestedKey) {
      return args[nestedKey] as Record<string, unknown>;
    }

    return Object.entries(args).reduce<Record<string, unknown>>(
      (accumulator, [key, value]) => {
        if (
          [
            "operation",
            "operation_id",
            "operationId",
            "endpoint",
            "endpointId",
            "method",
          ].includes(key)
        ) {
          return accumulator;
        }
        accumulator[key] = value;
        return accumulator;
      },
      {},
    );
  }

  private matchesToolName(toolName: string, requestedName: string): boolean {
    const normalize = (value: string) =>
      value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

    return (
      toolName.trim() === requestedName.trim() ||
      toolName.trim().toLowerCase() === requestedName.trim().toLowerCase() ||
      normalize(toolName) === normalize(requestedName)
    );
  }

  private normalizeAwarenessContext(input: unknown): string[] {
    if (!Array.isArray(input)) {
      throw new ToolExecutionWrappedError(
        "AWARENESS.updateContext expects an array of strings.",
        {
          kind: "awareness",
          userMessage:
            "AWARENESS.updateContext expects an array of strings.",
          operation: "AWARENESS.updateContext",
        },
      );
    }

    return input
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
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

        if (typeof value === "string") {
          const normalized = value.trim().toLowerCase();

          if (normalized === "true") {
            return true;
          }

          if (normalized === "false") {
            return false;
          }
        }

        throw new Error(`Argument "${name}" must be a boolean.`);

      case "array":
        if (Array.isArray(value)) {
          return value;
        }

        throw new Error(`Argument "${name}" must be an array.`);

      case "object":
        if (this.isObject(value)) {
          return value;
        }

        throw new Error(`Argument "${name}" must be an object.`);

      case "string":
      default:
        return typeof value === "string" ? value : String(value);
    }
  }

  private normalizePlatformInput(
    input: unknown,
    fallbackKey: string,
  ): Record<string, unknown> {
    return this.normalizeObjectInput(input, fallbackKey);
  }

  private buildExecutionScript(code: string): string {
    return `
        const { args, ENV, MEMORY, DATASOURCE, FUNCTION, AWARENESS, PLATFORM, LOG, HTTP } = executor;
        return (async () => {
${code}
          return { success: true, result: null };
        })();
      `;
  }

  private async fetchWithContext(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      throw new ToolExecutionWrappedError(
        `Network request failed for ${init.method ?? "GET"} ${url}.`,
        {
          kind: "network",
          userMessage: `Network request failed while calling ${init.method ?? "GET"} ${url}. Check the URL, host availability, or network policy.`,
          item: `${init.method ?? "GET"} ${url}`,
          operation: `HTTP.${String(init.method ?? "GET").toLowerCase()}`,
          url,
          details: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  private async parseHttpResponse(
    response: Response,
    request: { method: string; url: string },
  ): Promise<unknown> {
    const text = await response.text();

    if (!response.ok) {
      throw new ToolExecutionWrappedError(
        `HTTP ${response.status}: ${text || response.statusText}`,
        {
          kind: "http",
          userMessage: `HTTP ${request.method} ${request.url} failed with status ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`,
          item: `${request.method} ${request.url}`,
          operation: `HTTP.${request.method.toLowerCase()}`,
          url: request.url,
          status: response.status,
          details: text || response.statusText,
        },
      );
    }

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private appendQuery(url: string, params?: Record<string, unknown>): string {
    if (!params || Object.keys(params).length === 0) {
      return url;
    }

    const parsed = new URL(url);

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }

      parsed.searchParams.set(key, String(value));
    }

    return parsed.toString();
  }

  private formatExecutionError(
    error: unknown,
    toolCode: string,
  ): {
    message: string;
    userMessage: string;
    kind: string;
    suggestion?: string;
    item?: string;
    operation?: string;
    status?: number;
    url?: string;
    debug?: unknown;
    line?: number;
    column?: number;
  } {
    if (error instanceof ToolExecutionWrappedError) {
      const stack = error.stack || "";
      const match = stack.match(/<anonymous>:(\d+):(\d+)/);
      const location = this.mapToUserCodeLocation(toolCode, match);

      return {
        message: error.message,
        userMessage: this.withUserCodeLocation(error.meta.userMessage, location.line),
        kind: error.meta.kind,
        suggestion: error.meta.suggestion,
        item: error.meta.item,
        operation: error.meta.operation,
        status: error.meta.status,
        url: error.meta.url,
        debug: this.buildSafeDebugPayload(location.excerpt, error.meta.details),
        line: location.line,
        column: location.column,
      };
    }

    if (!(error instanceof Error)) {
      return {
        message: "Unknown execution error.",
        userMessage: "The tool failed with an unknown execution error.",
        kind: "runtime",
        debug: { value: String(error) },
      };
    }

    const stack = error.stack || "";
    const match = stack.match(/<anonymous>:(\d+):(\d+)/);
    const location = this.mapToUserCodeLocation(toolCode, match);
    const isSyntaxError = error instanceof SyntaxError;
    const suggestion = isSyntaxError
      ? this.getSyntaxSuggestion(
          error.message,
          toolCode,
          location.line,
          location.column,
        )
      : undefined;
    const cleanMessage =
      error.message && error.message.trim() && error.message.trim() !== "Error"
        ? isSyntaxError
          ? `Syntax error${location.line ? ` at line ${location.line}` : ""}: ${this.sanitizeUserErrorMessage(error.message)}`
          : error.message
        : location.line
          ? `The tool failed at line ${location.line}.`
          : "The tool execution failed.";

    return {
      message: error.message,
      userMessage: cleanMessage,
      kind: isSyntaxError ? "syntax" : "runtime",
      suggestion,
      debug: this.buildSafeDebugPayload(location.excerpt, {
        message: this.sanitizeUserErrorMessage(error.message),
        suggestion,
      }),
      line: location.line,
      column: location.column,
    };
  }

  private mapToUserCodeLocation(
    toolCode: string,
    match: RegExpMatchArray | null,
  ): {
    line?: number;
    column?: number;
    excerpt?: ToolCodeExcerptLine[];
  } {
    if (!match) {
      return {};
    }

    const rawLine = Number(match[1]);
    const rawColumn = Number(match[2]);
    const userLine = Math.max(rawLine - AgentToolExecutionService.USER_CODE_LINE_OFFSET, 1);
    const lines = toolCode.split("\n");
    const start = Math.max(userLine - 2, 1);
    const end = Math.min(userLine + 2, lines.length);
    const excerpt = [];

    for (let lineNumber = start; lineNumber <= end; lineNumber += 1) {
      excerpt.push({
        lineNumber,
        content: lines[lineNumber - 1] ?? "",
        highlight: lineNumber === userLine,
      });
    }

    return {
      line: userLine,
      column: rawColumn,
      excerpt,
    };
  }

  private buildSafeDebugPayload(
    excerpt?: ToolCodeExcerptLine[],
    details?: unknown,
  ): unknown {
    const payload: Record<string, unknown> = {};

    if (excerpt && excerpt.length > 0) {
      payload.codeLocation = {
        excerpt,
      };
    }

    const safeDetails = this.sanitizeDebugDetails(details);
    if (safeDetails !== undefined) {
      payload.details = safeDetails;
    }

    return Object.keys(payload).length > 0 ? payload : undefined;
  }

  private sanitizeDebugDetails(details: unknown): unknown {
    if (details === undefined || details === null) {
      return undefined;
    }

    if (typeof details === "string") {
      return this.removeInternalReferences(details);
    }

    if (Array.isArray(details)) {
      return details.map((entry) => this.sanitizeDebugDetails(entry));
    }

    if (typeof details === "object") {
      const sanitized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(details)) {
        if (key.toLowerCase() === "stack") {
          continue;
        }
        sanitized[key] = this.sanitizeDebugDetails(value);
      }

      return sanitized;
    }

    return details;
  }

  private removeInternalReferences(value: string): string {
    return value
      .split("\n")
      .filter(
        (line) =>
          !line.includes("executeWithLogs") &&
          !line.includes("RouteExecutor") &&
          !line.includes("RouteRegistrar") &&
          !line.includes("fragment-ts") &&
          !line.includes("node:internal") &&
          !line.includes("eval at executeWithLogs"),
      )
      .join("\n")
      .trim();
  }

  private sanitizeUserErrorMessage(message: string): string {
    const cleaned = this.removeInternalReferences(message)
      .replace(/^Error:\s*/i, "")
      .trim();

    return cleaned || "The tool execution failed.";
  }

  private withUserCodeLocation(message: string, line?: number): string {
    if (!line) {
      return message;
    }

    if (message.includes(`line ${line}`)) {
      return message;
    }

    return `${message} Failing line ${line}.`;
  }

  private getSyntaxSuggestion(
    message: string,
    toolCode: string,
    line?: number,
    column?: number,
  ): string | undefined {
    const sourceLine =
      line && line > 0 ? (toolCode.split("\n")[line - 1] ?? "").trim() : "";
    const pointer =
      sourceLine && column
        ? `${sourceLine}\n${" ".repeat(Math.max(column - 1, 0))}^`
        : sourceLine || undefined;

    if (message.includes("Unexpected token ':'")) {
      if (/: \w+/.test(sourceLine) || /:\s*[A-Za-z_$][\w$<>\[\]\|]*/.test(sourceLine)) {
        return `This looks like a type annotation, but tool code runs as JavaScript at runtime. Remove the ': type' part or move types into schema definitions.${pointer ? `\n\nLine:\n${pointer}` : ""}`;
      }

      if (/^\s*[A-Za-z_$][\w$]*\s*:/.test(sourceLine)) {
        return `This line looks like an object property outside of an object literal. Wrap it in { ... } or turn it into an assignment.${pointer ? `\n\nLine:\n${pointer}` : ""}`;
      }

      return `A colon is being used where JavaScript does not expect it. Check for a misplaced object property, ternary, or type annotation near this line.${pointer ? `\n\nLine:\n${pointer}` : ""}`;
    }

    if (message.includes("Unexpected token ')'")) {
      return `Check for an extra closing parenthesis or a missing value before ')'.${pointer ? `\n\nLine:\n${pointer}` : ""}`;
    }

    if (message.includes("Unexpected token '}'")) {
      return `Check for an extra closing brace or a missing opening block before this line.${pointer ? `\n\nLine:\n${pointer}` : ""}`;
    }

    if (message.includes("Unexpected end of input")) {
      return `The code ends before a block, function, string, or expression is fully closed.${pointer ? `\n\nLast relevant line:\n${pointer}` : ""}`;
    }

    return `Review the syntax near this line and compare brackets, braces, commas, and object literals.${pointer ? `\n\nLine:\n${pointer}` : ""}`;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
}
