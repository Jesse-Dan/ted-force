import { Autowired, Service } from "fragment-ts";
import { RequestContextHolder } from "../../../common/context/request-context-holder";
import {
  AgentConnector,
  ConnectorAuthConfig,
  ConnectorOperation,
  ConnectorOperationParam,
} from "../../../entities/agent-connector.entity";
import { ConnectorHttpMethod } from "../../../entities/enums/connector-http-method.enum";
import { AgentToolExecutionRepository } from "../../agent/repositories/agent-tool-execution.repository";
import { AgentConnectorExecutionLogRepository } from "../repositories/agent-connector-execution-log.repository";
import { AgentConnectorRepository } from "../repositories/agent-connector.repository";

type RuntimeExecuteInput = {
  agentId: string;
  connectorReference: string;
  operationId?: string;
  parameters?: Record<string, unknown>;
  sessionId?: string;
  requireLive?: boolean;
  requirePublic?: boolean;
};

type RuntimeExecuteByIdInput = {
  agentId: string;
  connectorId: string;
  operationId: string;
  parameters?: Record<string, unknown>;
  sessionId?: string;
  requireLive?: boolean;
  requirePublic?: boolean;
};

type ResolvedConnectorInvocation = {
  connector: AgentConnector;
  operation: ConnectorOperation;
  parameters: Record<string, unknown>;
  dependencyWarnings: string[];
};

@Service()
export class ConnectorRuntimeService {
  private static readonly sessionOperationHistory = new Map<string, Set<string>>();

  @Autowired()
  private agentConnectorRepository!: AgentConnectorRepository;

  @Autowired()
  private executionRepository!: AgentToolExecutionRepository;

  @Autowired()
  private executionLogRepository!: AgentConnectorExecutionLogRepository;

  async executeOperationByReference(input: RuntimeExecuteInput) {
    const invocation = await this.resolveOperationByReference(input);
    return this.executeResolvedOperation({
      agentId: input.agentId,
      connector: invocation.connector,
      operation: invocation.operation,
      parameters: invocation.parameters,
      dependencyWarnings: invocation.dependencyWarnings,
      sessionId: input.sessionId,
    });
  }

  async executeOperationByConnectorId(input: RuntimeExecuteByIdInput) {
    const connector = await this.agentConnectorRepository.findByIdAndAgentId(
      input.connectorId,
      input.agentId,
    );
    if (!connector) {
      throw new Error(`Connector ${input.connectorId} was not found.`);
    }

    const invocation = this.resolveOperationFromConnector({
      connector,
      operationId: input.operationId,
      parameters: input.parameters,
      requireLive: input.requireLive ?? true,
      requirePublic: input.requirePublic ?? false,
      sessionId: input.sessionId,
    });

    return this.executeResolvedOperation({
      agentId: input.agentId,
      connector,
      operation: invocation.operation,
      parameters: invocation.parameters,
      dependencyWarnings: invocation.dependencyWarnings,
      sessionId: input.sessionId,
    });
  }

  async resolveOperationByReference(
    input: RuntimeExecuteInput,
  ): Promise<ResolvedConnectorInvocation> {
    const connector = await this.resolveConnectorByReference(
      input.agentId,
      input.connectorReference,
    );

    if (!connector) {
      throw new Error(
        `Connector "${input.connectorReference}" was not found for this agent.`,
      );
    }

    return this.resolveOperationFromConnector({
      connector,
      operationId: input.operationId,
      parameters: input.parameters,
      requireLive: input.requireLive ?? true,
      requirePublic: input.requirePublic ?? false,
      sessionId: input.sessionId,
    });
  }

  buildConnectorPlatformToolSchema(
    connector: AgentConnector,
    operationId?: string,
  ): Record<string, unknown> {
    const operations = this.normalizeOperations(connector.operations);
    if (!operations.length) {
      return {
        type: "object",
        properties: {},
        additionalProperties: true,
      };
    }

    const operation =
      (operationId
        ? operations.find((entry) => entry.id === operationId)
        : null) ?? operations[0];
    return this.buildOperationSchema(operation);
  }

  buildOperationSchema(operation: ConnectorOperation): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    const required = new Set<string>();

    for (const parameter of operation.parameters ?? []) {
      properties[parameter.name] = {
        type: this.toJsonSchemaType(parameter.type),
        description: parameter.description || `${parameter.in} parameter`,
        ...(parameter.enum?.length ? { enum: parameter.enum } : {}),
      };
      if (parameter.required) {
        required.add(parameter.name);
      }
    }

    if (
      operation.requestBodySchema &&
      typeof operation.requestBodySchema === "object"
    ) {
      properties.body = operation.requestBodySchema;
      required.add("body");
    }

    return {
      type: "object",
      properties,
      required: [...required],
      additionalProperties: true,
    };
  }

  private async executeResolvedOperation(input: {
    agentId: string;
    connector: AgentConnector;
    operation: ConnectorOperation;
    parameters: Record<string, unknown>;
    dependencyWarnings: string[];
    sessionId?: string;
  }) {
    const environment = await this.executionRepository.getEnvironmentMap(input.agentId);
    const request = this.buildRequest({
      connector: input.connector,
      operation: input.operation,
      parameters: input.parameters,
      environment,
    });

    const response = await fetch(request.url, {
      method: input.operation.method,
      headers: request.headers,
      body: request.body,
    });

    const responseText = await response.text();
    const responseBody = this.parseResponseBody(responseText);
    const execution = {
      method: input.operation.method,
      url: request.url,
      headers: request.safeHeaders,
      body: request.bodyObject,
    };

    const intent = `Execute ${input.connector.name}.${input.operation.id}`;
    const plan = `Validate inputs, resolve env/auth, and call ${input.operation.method} ${request.url}`;
    const outcome = response.ok
      ? `Operation succeeded with status ${response.status}.`
      : `Operation failed with status ${response.status}.`;

    const logEntry = await this.executionLogRepository.save({
      agentId: input.agentId,
      connectorId: input.connector.id,
      sessionId: input.sessionId ?? null,
      operationId: input.operation.id,
      intent,
      plan,
      execution: JSON.stringify(execution),
      outcome,
      responseStatus: response.status,
      success: response.ok,
      metadata: {
        dependencyWarnings: input.dependencyWarnings,
      },
    });

    this.markOperationExecuted(
      input.agentId,
      input.connector.id,
      input.operation.id,
      input.sessionId,
    );

    return {
      success: response.ok,
      connector: {
        id: input.connector.id,
        name: input.connector.name,
        slug: input.connector.slug,
        source: input.connector.source,
      },
      operation: {
        id: input.operation.id,
        name: input.operation.name,
        method: input.operation.method,
        path: input.operation.path,
      },
      request: execution,
      response: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
        raw: typeof responseBody === "string" ? responseBody : undefined,
      },
      observability: {
        intent,
        plan,
        execution,
        outcome,
        logId: logEntry.id,
      },
      dependencyWarnings: input.dependencyWarnings,
    };
  }

  private resolveOperationFromConnector(input: {
    connector: AgentConnector;
    operationId?: string;
    parameters?: Record<string, unknown>;
    requireLive: boolean;
    requirePublic: boolean;
    sessionId?: string;
  }): ResolvedConnectorInvocation {
    if (input.requireLive && !input.connector.isLive) {
      throw new Error(`Connector "${input.connector.name}" is not live.`);
    }
    if (input.requirePublic && !input.connector.isPublic) {
      throw new Error(`Connector "${input.connector.name}" is not public.`);
    }

    const operations = this.normalizeOperations(input.connector.operations).filter(
      (operation) => operation.permissionLevel !== "never_allow",
    );
    if (!operations.length) {
      throw new Error(`Connector "${input.connector.name}" has no operations.`);
    }

    const selectedOperation = input.operationId
      ? operations.find(
          (operation) =>
            this.normalizeName(operation.id) === this.normalizeName(input.operationId ?? "") ||
            this.normalizeName(operation.name) === this.normalizeName(input.operationId ?? ""),
        )
      : operations.length === 1
        ? operations[0]
        : null;

    if (!selectedOperation) {
      throw new Error(
        input.operationId
          ? `Operation "${input.operationId}" was not found on connector "${input.connector.name}".`
          : `Connector "${input.connector.name}" has multiple operations; operation_id is required.`,
      );
    }

    if (!selectedOperation.isExposed) {
      throw new Error(`Operation "${selectedOperation.name}" is hidden.`);
    }

    const normalizedParameters = this.normalizeParameters(input.parameters);
    this.validateRequiredParameters(selectedOperation.parameters, normalizedParameters);

    const dependencyWarnings = this.readDependencyWarnings({
      connectorId: input.connector.id,
      operation: selectedOperation,
      agentId: input.connector.agentId,
      sessionId: input.sessionId,
    });

    return {
      connector: input.connector,
      operation: selectedOperation,
      parameters: normalizedParameters,
      dependencyWarnings,
    };
  }

  private readDependencyWarnings(input: {
    connectorId: string;
    operation: ConnectorOperation;
    agentId: string;
    sessionId?: string;
  }): string[] {
    const dependencies = input.operation.dependsOn ?? [];
    if (!dependencies.length) {
      return [];
    }

    const history = this.readSessionHistory(
      input.agentId,
      input.connectorId,
      input.sessionId,
    );
    const missing = dependencies.filter((dependency) => !history.has(dependency));
    if (!missing.length) {
      return [];
    }

    return [
      `Operation "${input.operation.id}" depends on: ${missing.join(", ")}.`,
    ];
  }

  private markOperationExecuted(
    agentId: string,
    connectorId: string,
    operationId: string,
    sessionId?: string,
  ) {
    const sessionKey = this.buildSessionHistoryKey(agentId, connectorId, sessionId);
    const history = ConnectorRuntimeService.sessionOperationHistory.get(sessionKey) ?? new Set<string>();
    history.add(operationId);
    ConnectorRuntimeService.sessionOperationHistory.set(sessionKey, history);
  }

  private readSessionHistory(
    agentId: string,
    connectorId: string,
    sessionId?: string,
  ) {
    const sessionKey = this.buildSessionHistoryKey(agentId, connectorId, sessionId);
    return ConnectorRuntimeService.sessionOperationHistory.get(sessionKey) ?? new Set<string>();
  }

  private buildSessionHistoryKey(
    agentId: string,
    connectorId: string,
    sessionId?: string,
  ) {
    const contextSession = RequestContextHolder.get()?.sessionId;
    const finalSessionId = sessionId || contextSession || "default";
    return `${agentId}:${connectorId}:${finalSessionId}`;
  }

  private buildRequest(input: {
    connector: AgentConnector;
    operation: ConnectorOperation;
    parameters: Record<string, unknown>;
    environment: Record<string, string>;
  }) {
    const pathParams = input.operation.parameters.filter((param) => param.in === "path");
    const queryParams = input.operation.parameters.filter((param) => param.in === "query");
    const headerParams = input.operation.parameters.filter((param) => param.in === "header");
    const bodyParams = input.operation.parameters.filter((param) => param.in === "body");
    const baseCandidate =
      this.resolveStringValue(input.connector.envConfig?.baseUrl, input.environment) ??
      this.resolveStringValue(input.connector.envConfig?.base_url, input.environment) ??
      null;

    let url = input.operation.url?.trim() || input.operation.path || "/";
    if (baseCandidate && !/^https?:\/\//i.test(url)) {
      url = `${baseCandidate.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
    }
    url = this.applyTemplate(url, input.parameters, input.environment);

    for (const pathParam of pathParams) {
      const value = input.parameters[pathParam.name];
      if (value === undefined || value === null) {
        continue;
      }
      const encoded = encodeURIComponent(String(value));
      url = url
        .replace(new RegExp(`\\{${pathParam.name}\\}`, "g"), encoded)
        .replace(new RegExp(`:${pathParam.name}(?=/|$)`, "g"), encoded);
    }

    const urlObject = this.toUrl(url);
    for (const queryParam of queryParams) {
      const rawValue = input.parameters[queryParam.name];
      if (rawValue === undefined || rawValue === null || rawValue === "") {
        continue;
      }
      urlObject.searchParams.set(queryParam.name, String(rawValue));
    }

    const headers: Record<string, string> = {};
    const safeHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.operation.headers ?? {})) {
      const resolved = this.applyTemplate(String(value ?? ""), input.parameters, input.environment);
      headers[key] = resolved;
      safeHeaders[key] = this.maskSensitiveHeader(key, resolved);
    }

    for (const headerParam of headerParams) {
      const value = input.parameters[headerParam.name];
      if (value === undefined || value === null) {
        continue;
      }
      headers[headerParam.name] = String(value);
      safeHeaders[headerParam.name] = this.maskSensitiveHeader(
        headerParam.name,
        String(value),
      );
    }

    this.applyAuth({
      auth: input.connector.authConfig,
      headers,
      safeHeaders,
      query: urlObject.searchParams,
      environment: input.environment,
    });

    const bodyObject = this.buildRequestBody({
      operation: input.operation,
      bodyParams,
      parameters: input.parameters,
    });

    const body =
      bodyObject === undefined ||
      input.operation.method === ConnectorHttpMethod.GET ||
      input.operation.method === ConnectorHttpMethod.DELETE
        ? undefined
        : JSON.stringify(bodyObject);
    if (body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    return {
      url: urlObject.toString(),
      headers,
      safeHeaders,
      body,
      bodyObject,
    };
  }

  private buildRequestBody(input: {
    operation: ConnectorOperation;
    bodyParams: ConnectorOperationParam[];
    parameters: Record<string, unknown>;
  }) {
    if (input.parameters.body && typeof input.parameters.body === "object") {
      return input.parameters.body;
    }

    if (input.operation.requestBodySchema) {
      return input.parameters.body ?? {};
    }

    if (!input.bodyParams.length) {
      return undefined;
    }

    return input.bodyParams.reduce<Record<string, unknown>>((acc, param) => {
      const value = input.parameters[param.name];
      if (value !== undefined) {
        acc[param.name] = value;
      }
      return acc;
    }, {});
  }

  private applyAuth(input: {
    auth?: ConnectorAuthConfig | null;
    headers: Record<string, string>;
    safeHeaders: Record<string, string>;
    query: URLSearchParams;
    environment: Record<string, string>;
  }) {
    const auth = input.auth;
    if (!auth || auth.type === "none") {
      return;
    }

    const credentials = auth.credentials ?? undefined;
    const readCredential = (keyName?: string) => {
      if (!credentials) {
        return null;
      }

      if (credentials.source === "inline") {
        if (keyName === "username") {
          return credentials.username ?? null;
        }
        if (keyName === "password") {
          return credentials.password ?? null;
        }
        return credentials.value ?? null;
      }

      if (keyName === "username") {
        const usernameKey = credentials.usernameKey;
        return usernameKey ? input.environment[usernameKey] ?? null : null;
      }
      if (keyName === "password") {
        const passwordKey = credentials.passwordKey;
        return passwordKey ? input.environment[passwordKey] ?? null : null;
      }
      return credentials.key ? input.environment[credentials.key] ?? null : null;
    };

    if (auth.type === "bearer" || auth.type === "oauth2") {
      const token = readCredential();
      if (token) {
        input.headers.Authorization = `Bearer ${token}`;
        input.safeHeaders.Authorization = "Bearer ***";
      }
      return;
    }

    if (auth.type === "basic") {
      const username = readCredential("username") ?? "";
      const password = readCredential("password") ?? "";
      const encoded = Buffer.from(`${username}:${password}`).toString("base64");
      input.headers.Authorization = `Basic ${encoded}`;
      input.safeHeaders.Authorization = "Basic ***";
      return;
    }

    if (auth.type === "api_key") {
      const keyValue = readCredential();
      if (!keyValue) {
        return;
      }

      const keyName = credentials?.keyName || "x-api-key";
      const injectTo = credentials?.injectTo || "header";
      if (injectTo === "query") {
        input.query.set(keyName, keyValue);
      } else {
        input.headers[keyName] = keyValue;
        input.safeHeaders[keyName] = "***";
      }
    }
  }

  private parseResponseBody(input: string): unknown {
    if (!input) {
      return null;
    }
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }

  private async resolveConnectorByReference(
    agentId: string,
    connectorReference: string,
  ): Promise<AgentConnector | null> {
    const normalizedReference = this.normalizeName(connectorReference);
    if (!normalizedReference) {
      return null;
    }

    const byId = await this.agentConnectorRepository.findById(connectorReference);
    if (byId?.agentId === agentId) {
      return byId;
    }

    const bySlug = await this.agentConnectorRepository.findByAgentAndSlug(
      agentId,
      connectorReference,
    );
    if (bySlug) {
      return bySlug;
    }

    const connectors = await this.agentConnectorRepository.listByAgentId(agentId);
    return (
      connectors.find(
        (connector) =>
          this.normalizeName(connector.slug) === normalizedReference ||
          this.normalizeName(connector.name) === normalizedReference,
      ) ?? null
    );
  }

  private normalizeOperations(raw: AgentConnector["operations"]): ConnectorOperation[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((operation) => operation && typeof operation === "object")
      .map((operation) => operation as ConnectorOperation)
      .filter(
        (operation) =>
          typeof operation.id === "string" &&
          operation.id.trim().length > 0 &&
          typeof operation.method === "string" &&
          typeof operation.path === "string",
      );
  }

  private normalizeParameters(input: Record<string, unknown> | undefined) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return {};
    }
    return input;
  }

  private validateRequiredParameters(
    parameters: ConnectorOperationParam[],
    values: Record<string, unknown>,
  ) {
    for (const parameter of parameters) {
      if (!parameter.required) {
        continue;
      }

      const value = values[parameter.name];
      if (value === undefined || value === null || value === "") {
        throw new Error(`Parameter "${parameter.name}" is required.`);
      }
    }
  }

  private resolveStringValue(
    value: string | undefined,
    environment: Record<string, string>,
  ): string | null {
    if (!value || typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
      const key = trimmed.slice(2, -2).trim();
      return environment[key] ?? null;
    }
    return trimmed;
  }

  private applyTemplate(
    value: string,
    parameters: Record<string, unknown>,
    environment: Record<string, string>,
  ): string {
    return value.replace(/\{\{\s*([^{}]+)\s*\}\}/g, (_match, tokenRaw: string) => {
      const token = String(tokenRaw ?? "").trim();
      if (!token) {
        return "";
      }
      if (token in parameters) {
        return String(parameters[token] ?? "");
      }
      if (token in environment) {
        return environment[token] ?? "";
      }
      return `{{${token}}}`;
    });
  }

  private toUrl(url: string): URL {
    if (/^https?:\/\//i.test(url)) {
      return new URL(url);
    }
    return new URL(`https://placeholder.local/${url.replace(/^\/+/, "")}`);
  }

  private maskSensitiveHeader(key: string, value: string): string {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("api-key") ||
      normalizedKey.includes("secret")
    ) {
      return "***";
    }
    return value;
  }

  private toJsonSchemaType(type: string): string {
    switch (type.toLowerCase()) {
      case "integer":
      case "float":
      case "double":
      case "number":
        return "number";
      case "boolean":
        return "boolean";
      case "object":
        return "object";
      case "array":
        return "array";
      default:
        return "string";
    }
  }

  private normalizeName(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }
}
