import { Autowired, Service } from "fragment-ts";
import { AgentClientAccessService } from "../../../common/services/agent-client-access.service";
import {
  AgentConnector,
  ConnectorOperation,
} from "../../../entities/agent-connector.entity";
import { ConnectorHttpMethod } from "../../../entities/enums/connector-http-method.enum";
import { ConnectorSource } from "../../../entities/enums/connector-source.enum";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { AgentConnectorExecutionLogRepository } from "../repositories/agent-connector-execution-log.repository";
import { AgentConnectorRepository } from "../repositories/agent-connector.repository";
import { PlatformConnectorRepository } from "../repositories/platform-connector.repository";
import { parseOpenApiSpec } from "../utils/openapi-parser.util";
import { parsePostmanCollection } from "../utils/postman-parser.util";
import { ConnectorRuntimeService } from "./connector-runtime.service";

type ConnectorMutationPayload = {
  name?: string;
  description?: string | null;
  source?: ConnectorSource;
  auth?: Record<string, unknown> | null;
  operations?: Record<string, unknown>[] | null;
  envConfig?: Record<string, string> | null;
  envRefs?: Array<Record<string, unknown>> | null;
  isLive?: boolean;
  isPublic?: boolean;
  logoUrl?: string | null;
};

@Service()
export class ConnectorsService {
  @Autowired()
  private agentRepository!: AgentRepository;

  @Autowired()
  private agentConnectorRepository!: AgentConnectorRepository;

  @Autowired()
  private platformConnectorRepository!: PlatformConnectorRepository;

  @Autowired()
  private connectorRuntimeService!: ConnectorRuntimeService;

  @Autowired()
  private connectorExecutionLogs!: AgentConnectorExecutionLogRepository;

  @Autowired()
  private agentClientAccessService!: AgentClientAccessService;

  async listAgentConnectors(agentId: string, options?: { liveOnly?: boolean }) {
    await this.assertAgentExists(agentId);
    const connectors = options?.liveOnly
      ? await this.agentConnectorRepository.listLiveByAgentId(agentId)
      : await this.agentConnectorRepository.listByAgentId(agentId);
    return connectors.map((connector) => this.serializeConnector(connector));
  }

  async getConnector(agentId: string, connectorId: string) {
    await this.assertAgentExists(agentId);
    const connector = await this.agentConnectorRepository.findByIdAndAgentId(
      connectorId,
      agentId,
    );
    if (!connector) {
      throw new Error(`Connector ${connectorId} not found for this agent.`);
    }
    return this.serializeConnector(connector);
  }

  async createConnector(agentId: string, payload: ConnectorMutationPayload) {
    await this.assertAgentExists(agentId);
    const source = this.normalizeSource(payload.source);
    const name = String(payload.name ?? "").trim();
    if (!name) {
      throw new Error("Connector name is required.");
    }

    const slug = await this.resolveUniqueConnectorSlug(agentId, name);
    const operations = this.normalizeOperations(payload.operations);
    const graph = this.buildConnectorGraph(operations);
    const isLive = payload.isLive ?? false;
    const isPublic = payload.isPublic ?? false;

    const saved = await this.agentConnectorRepository.save({
      agentId,
      name,
      slug,
      description: payload.description?.trim() ?? null,
      source,
      authConfig: this.normalizeAuthConfig(payload.auth),
      operations,
      dependencyGraph: graph,
      envConfig: payload.envConfig ?? null,
      envRefs: this.normalizeEnvRefs(payload.envRefs),
      isLive,
      isPublic,
      enabled: isLive,
      isExposed: isPublic,
      httpMethod: this.resolveDefaultMethod(operations),
      toolName: "connector_operation",
      toolId: null,
      logoUrl: payload.logoUrl?.trim() ?? null,
    });

    return this.serializeConnector(saved);
  }

  async updateConnector(
    agentId: string,
    connectorId: string,
    payload: ConnectorMutationPayload,
  ) {
    await this.assertAgentExists(agentId);
    const existing = await this.agentConnectorRepository.findByIdAndAgentId(
      connectorId,
      agentId,
    );
    if (!existing) {
      throw new Error(`Connector ${connectorId} not found for this agent.`);
    }

    const operations =
      payload.operations === undefined
        ? this.normalizeOperations(existing.operations)
        : this.normalizeOperations(payload.operations);

    const nextSource =
      payload.source === undefined
        ? existing.source
        : this.normalizeSource(payload.source);
    const isLive = payload.isLive ?? existing.isLive ?? existing.enabled;
    const isPublic = payload.isPublic ?? existing.isPublic ?? existing.isExposed;

    const updated = await this.agentConnectorRepository.save({
      ...existing,
      name: payload.name?.trim() || existing.name,
      description:
        payload.description === undefined
          ? existing.description ?? null
          : payload.description?.trim() ?? null,
      source: nextSource,
      authConfig:
        payload.auth === undefined
          ? existing.authConfig ?? null
          : this.normalizeAuthConfig(payload.auth),
      operations,
      dependencyGraph: this.buildConnectorGraph(operations),
      envConfig:
        payload.envConfig === undefined
          ? existing.envConfig ?? null
          : payload.envConfig ?? null,
      envRefs:
        payload.envRefs === undefined
          ? existing.envRefs ?? null
          : this.normalizeEnvRefs(payload.envRefs),
      isLive,
      isPublic,
      enabled: isLive,
      isExposed: isPublic,
      httpMethod: this.resolveDefaultMethod(operations),
      logoUrl:
        payload.logoUrl === undefined
          ? existing.logoUrl ?? null
          : payload.logoUrl?.trim() ?? null,
    });

    return this.serializeConnector(updated);
  }

  async deleteConnector(agentId: string, connectorId: string) {
    await this.assertAgentExists(agentId);
    const existing = await this.agentConnectorRepository.findByIdAndAgentId(
      connectorId,
      agentId,
    );
    if (!existing) {
      throw new Error(`Connector ${connectorId} not found for this agent.`);
    }
    await this.agentConnectorRepository.deleteById(connectorId);
    return {
      id: connectorId,
      deleted: true,
    };
  }

  async importOpenApiConnector(input: {
    agentId: string;
    name: string;
    description?: string;
    specText?: string;
    specObject?: Record<string, unknown> | null;
    isLive?: boolean;
    isPublic?: boolean;
  }) {
    const parsed = parseOpenApiSpec({
      specText: input.specText,
      specObject: input.specObject,
    });

    const connector = await this.createConnector(input.agentId, {
      name: input.name,
      description: input.description,
      source: ConnectorSource.OPENAPI,
      operations: parsed.operations as unknown as Record<string, unknown>[],
      isLive: input.isLive ?? false,
      isPublic: input.isPublic ?? false,
    });

    const existing = await this.agentConnectorRepository.findById(connector.id);
    if (existing) {
      await this.agentConnectorRepository.save({
        ...existing,
        rawImport: parsed.rawImport,
        enrichedImport: {
          operations: parsed.operations,
          graph: parsed.graph,
          warnings: parsed.warnings,
        },
      });
    }

    return {
      connector: await this.getConnector(input.agentId, connector.id),
      warnings: parsed.warnings,
    };
  }

  async importPostmanConnectors(input: {
    agentId: string;
    name: string;
    description?: string;
    collectionJson: string;
    collectionObject?: Record<string, unknown> | null;
    isLive?: boolean;
    isPublic?: boolean;
  }) {
    const parsed = parsePostmanCollection({
      collectionText: input.collectionJson,
      collectionObject: input.collectionObject,
    });

    const connector = await this.createConnector(input.agentId, {
      name: input.name,
      description: input.description,
      source: ConnectorSource.POSTMAN,
      operations: parsed.operations as unknown as Record<string, unknown>[],
      envRefs: parsed.extractedEnvKeys.map((key) => ({
        field: "dynamic",
        env_key: key,
      })),
      isLive: input.isLive ?? false,
      isPublic: input.isPublic ?? false,
    });

    const existing = await this.agentConnectorRepository.findById(connector.id);
    if (existing) {
      await this.agentConnectorRepository.save({
        ...existing,
        rawImport: parsed.rawImport,
        enrichedImport: {
          operations: parsed.operations,
          graph: parsed.graph,
          warnings: parsed.warnings,
          extractedEnvKeys: parsed.extractedEnvKeys,
        },
      });
    }

    return {
      connector: await this.getConnector(input.agentId, connector.id),
      warnings: parsed.warnings,
      extractedEnvKeys: parsed.extractedEnvKeys,
    };
  }

  async getPostmanTemplate() {
    return {
      info: {
        name: "TUUL Connector Hub Template",
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: [
        {
          name: "Send Message",
          request: {
            method: "POST",
            header: [{ key: "Authorization", value: "Bearer {{API_TOKEN}}" }],
            body: {
              mode: "raw",
              raw: JSON.stringify(
                {
                  channel: "{{channel_id}}",
                  text: "Hello from connector hub",
                },
                null,
                2,
              ),
            },
            url: {
              raw: "https://api.example.com/v1/messages",
            },
            description:
              "Import this into TUUL to generate a stale connector ready for review and promotion.",
          },
        },
      ],
    };
  }

  async getConnectorSchema(agentId: string, connectorId: string) {
    const connector = await this.requireConnector(agentId, connectorId);
    const operations = this.normalizeOperations(connector.operations);
    return {
      connectorId: connector.id,
      connectorName: connector.name,
      operations: operations.map((operation) => ({
        id: operation.id,
        name: operation.name,
        schema: this.connectorRuntimeService.buildOperationSchema(operation),
      })),
    };
  }

  async getConnectorGraph(agentId: string, connectorId: string) {
    const connector = await this.requireConnector(agentId, connectorId);
    return (
      connector.dependencyGraph ?? {
        nodes: this.normalizeOperations(connector.operations).map((op) => op.id),
        edges: [],
      }
    );
  }

  async getConnectorLogs(agentId: string, connectorId: string, limit = 50) {
    await this.requireConnector(agentId, connectorId);
    return this.connectorExecutionLogs.listByConnector(connectorId, limit);
  }

  async executeConnectorCall(input: {
    agentId: string;
    connectorId: string;
    operationId: string;
    parameters?: Record<string, unknown>;
    sessionId?: string;
    requirePublic?: boolean;
  }) {
    await this.assertAgentExists(input.agentId);
    return this.connectorRuntimeService.executeOperationByConnectorId({
      agentId: input.agentId,
      connectorId: input.connectorId,
      operationId: input.operationId,
      parameters: input.parameters,
      sessionId: input.sessionId,
      requireLive: true,
      requirePublic: input.requirePublic ?? false,
    });
  }

  async executeAgentConnector(
    agentId: string,
    connectorReference: string,
    args: Record<string, unknown>,
    method?: ConnectorHttpMethod,
  ) {
    const operationId = this.readOperationId(args);
    const cleanedArgs = this.removeOperationEnvelope(args);
    const output = await this.connectorRuntimeService.executeOperationByReference({
      agentId,
      connectorReference,
      operationId,
      parameters: cleanedArgs,
      requireLive: true,
      requirePublic: false,
    });

    if (method && output.operation.method !== method) {
      throw new Error(
        `Connector method mismatch. Expected ${method} but resolved ${output.operation.method}.`,
      );
    }

    return output;
  }

  async executeLiveConnector(
    agentReference: string,
    connectorReference: string,
    method: ConnectorHttpMethod,
    body?: Record<string, unknown>,
  ) {
    const agent = await this.resolveAgentByReference(agentReference);
    if (!agent) {
      throw new Error(`Agent "${agentReference}" is not available.`);
    }

    const operationId = this.readOperationId(body ?? {});
    const output = await this.connectorRuntimeService.executeOperationByReference({
      agentId: agent.id,
      connectorReference,
      operationId,
      parameters: this.removeOperationEnvelope(body ?? {}),
      requireLive: true,
      requirePublic: true,
    });

    if (output.operation.method !== method) {
      throw new Error(
        `Connector endpoint expects ${output.operation.method}, but ${method} was received.`,
      );
    }

    return output;
  }

  async listAgentConnectorPlatformTools(agentId: string) {
    const connectors = await this.listAgentConnectors(agentId, { liveOnly: true });
    const tools = connectors.flatMap((connector) =>
      (connector.operations ?? [])
        .filter((operation) => operation.isExposed)
        .map((operation) => ({
          id: `${connector.id}:${operation.id}`,
          key: `connector_${connector.slug}_${operation.id}`,
          name: `${connector.name} :: ${operation.name}`,
          description: operation.description,
          sourceType: connector.source,
          httpMethod: operation.method,
          connector: {
            id: connector.id,
            slug: connector.slug,
            name: connector.name,
            isExposed: connector.is_public,
            enabled: connector.is_live,
          },
          operation: {
            id: operation.id,
            name: operation.name,
            permissionLevel: operation.permissionLevel,
          },
          schema: this.connectorRuntimeService.buildOperationSchema(operation),
          sampleCall: `await PLATFORM.connector({ connector: "${connector.slug}", operation: "${operation.id}", parameters: {} })`,
        })),
    );
    return tools;
  }

  async listPlatformConnectors() {
    return this.platformConnectorRepository.listActive();
  }

  async listBackofficePlatformConnectors() {
    return this.platformConnectorRepository.listAll();
  }

  async createBackofficePlatformConnector(payload: {
    key: string;
    name: string;
    provider?: string;
    description?: string | null;
    category?: string;
    isActive?: boolean;
    uploadSource?: string;
    uploadId?: string | null;
    logoUrl?: string | null;
    version?: string;
    definition?: Record<string, unknown> | null;
  }) {
    const key = this.normalizePlatformConnectorKey(payload.key);
    const existing = await this.platformConnectorRepository.findByKey(key);
    if (existing) {
      throw new Error(`Platform connector key "${key}" already exists.`);
    }

    return this.platformConnectorRepository.save({
      key,
      name: payload.name.trim(),
      provider: (payload.provider || key).trim().toLowerCase(),
      description: payload.description?.trim() ?? null,
      category: payload.category?.trim() || "General",
      isActive: payload.isActive ?? true,
      isOfficial: true,
      version: payload.version?.trim() || "1.0.0",
      uploadSource: payload.uploadSource?.trim() ?? "admin_backoffice",
      uploadId: payload.uploadId?.trim() ?? null,
      logoUrl: payload.logoUrl?.trim() ?? null,
      definition:
        payload.definition && typeof payload.definition === "object"
          ? payload.definition
          : null,
    });
  }

  async updateBackofficePlatformConnector(
    connectorId: string,
    payload: {
      key?: string;
      name?: string;
      provider?: string;
      description?: string | null;
      category?: string;
      isActive?: boolean;
      uploadSource?: string | null;
      uploadId?: string | null;
      logoUrl?: string | null;
      version?: string;
      definition?: Record<string, unknown> | null;
    },
  ) {
    const existing = await this.platformConnectorRepository.findById(connectorId);
    if (!existing) {
      throw new Error(`Platform connector ${connectorId} not found.`);
    }

    const nextKey =
      payload.key === undefined
        ? existing.key
        : this.normalizePlatformConnectorKey(payload.key);

    if (nextKey !== existing.key) {
      const duplicate = await this.platformConnectorRepository.findByKey(nextKey);
      if (duplicate && duplicate.id !== connectorId) {
        throw new Error(`Platform connector key "${nextKey}" already exists.`);
      }
    }

    return this.platformConnectorRepository.save({
      ...existing,
      key: nextKey,
      name: payload.name?.trim() ?? existing.name,
      provider:
        payload.provider === undefined
          ? existing.provider
          : payload.provider.trim().toLowerCase(),
      description:
        payload.description === undefined
          ? existing.description ?? null
          : payload.description?.trim() ?? null,
      category: payload.category?.trim() || existing.category,
      isActive: payload.isActive ?? existing.isActive,
      uploadSource:
        payload.uploadSource === undefined
          ? existing.uploadSource ?? null
          : payload.uploadSource?.trim() ?? null,
      uploadId:
        payload.uploadId === undefined
          ? existing.uploadId ?? null
          : payload.uploadId?.trim() ?? null,
      logoUrl:
        payload.logoUrl === undefined
          ? existing.logoUrl ?? null
          : payload.logoUrl?.trim() ?? null,
      version: payload.version?.trim() || existing.version,
      definition:
        payload.definition === undefined
          ? existing.definition ?? null
          : payload.definition ?? null,
    });
  }

  async deleteBackofficePlatformConnector(connectorId: string) {
    const existing = await this.platformConnectorRepository.findById(connectorId);
    if (!existing) {
      throw new Error(`Platform connector ${connectorId} not found.`);
    }
    await this.platformConnectorRepository.deleteById(connectorId);
    return {
      id: connectorId,
      deleted: true,
    };
  }

  async activatePlatformConnector(
    platformConnectorId: string,
    payload: {
      agentId: string;
      name?: string;
      description?: string;
      isLive?: boolean;
      isPublic?: boolean;
    },
  ) {
    await this.assertAgentExists(payload.agentId);
    const platform = await this.platformConnectorRepository.findById(platformConnectorId);
    if (!platform || !platform.isActive) {
      throw new Error("Platform connector is not available.");
    }

    const definition = this.ensureRecord(platform.definition);
    const operations = this.normalizeOperations(
      (definition.operations as Record<string, unknown>[] | undefined) ?? [],
    );
    if (!operations.length) {
      throw new Error("Platform connector has no operations to activate.");
    }

    return this.createConnector(payload.agentId, {
      name: payload.name?.trim() || platform.name,
      description: payload.description?.trim() || platform.description || "",
      source: ConnectorSource.PLATFORM,
      operations: operations as unknown as Record<string, unknown>[],
      auth:
        this.ensureRecord(definition.auth).type !== undefined
          ? this.normalizeAuthConfig(this.ensureRecord(definition.auth))
          : null,
      envConfig: this.ensureRecord(definition.envConfig) as Record<string, string>,
      isLive: payload.isLive ?? false,
      isPublic: payload.isPublic ?? false,
      logoUrl: platform.logoUrl ?? null,
    });
  }

  async listPublicConnectors(agentId: string) {
    await this.agentClientAccessService.assertAgentAccess(agentId, "read");
    const connectors = await this.agentConnectorRepository.listPublicLiveByAgentId(
      agentId,
    );
    return connectors.map((connector) => this.serializeConnector(connector));
  }

  async getPublicConnector(agentId: string, connectorId: string) {
    await this.agentClientAccessService.assertAgentAccess(agentId, "read");
    const connector = await this.agentConnectorRepository.findByIdAndAgentId(
      connectorId,
      agentId,
    );
    if (!connector || !connector.isPublic || !connector.isLive) {
      throw new Error("Public connector not found.");
    }
    return this.serializeConnector(connector);
  }

  async executePublicConnectorCall(input: {
    agentId: string;
    connectorId: string;
    operationId: string;
    parameters?: Record<string, unknown>;
    sessionId?: string;
  }) {
    await this.agentClientAccessService.assertAgentAccess(input.agentId, "write");
    return this.executeConnectorCall({
      agentId: input.agentId,
      connectorId: input.connectorId,
      operationId: input.operationId,
      parameters: input.parameters,
      sessionId: input.sessionId,
      requirePublic: true,
    });
  }

  private serializeConnector(connector: AgentConnector) {
    const operations = this.normalizeOperations(connector.operations);
    return {
      id: connector.id,
      agentId: connector.agentId,
      name: connector.name,
      slug: connector.slug,
      description: connector.description ?? null,
      source: this.normalizeSource(connector.source),
      logo_url: connector.logoUrl ?? null,
      auth: connector.authConfig ?? { type: "none", credentials: null },
      operations,
      graph:
        connector.dependencyGraph ??
        this.buildConnectorGraph(operations),
      env_config: connector.envConfig ?? {},
      env_refs: connector.envRefs ?? [],
      is_live: connector.isLive,
      is_public: connector.isPublic,
      created_at: connector.createdAt,
      updated_at: connector.updatedAt,
      // Compatibility fields for existing UI/runtime while old code is being replaced.
      enabled: connector.isLive,
      isExposed: connector.isPublic,
      httpMethod: connector.httpMethod,
      toolName: connector.toolName,
    };
  }

  private async requireConnector(agentId: string, connectorId: string) {
    const connector = await this.agentConnectorRepository.findByIdAndAgentId(
      connectorId,
      agentId,
    );
    if (!connector) {
      throw new Error(`Connector ${connectorId} not found for this agent.`);
    }
    return connector;
  }

  private readOperationId(args: Record<string, unknown>) {
    const operation =
      args.operation_id ?? args.operationId ?? args.operation ?? args.endpoint;
    if (typeof operation === "string" && operation.trim()) {
      return operation.trim();
    }
    return undefined;
  }

  private removeOperationEnvelope(args: Record<string, unknown>) {
    const envelopeKey = ["parameters", "args", "input", "payload"].find((key) =>
      this.isObject(args[key]),
    );
    if (envelopeKey) {
      return args[envelopeKey] as Record<string, unknown>;
    }

    return Object.entries(args).reduce<Record<string, unknown>>(
      (accumulator, [key, value]) => {
        if (
          [
            "operation",
            "operation_id",
            "operationId",
            "endpoint",
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

  private async resolveAgentByReference(reference: string) {
    const byId = await this.agentRepository.findById(reference.trim());
    if (byId) {
      return byId;
    }
    return this.agentRepository.findBySlug(reference.trim());
  }

  private resolveDefaultMethod(operations: ConnectorOperation[]) {
    return operations[0]?.method ?? ConnectorHttpMethod.POST;
  }

  private normalizeSource(source: ConnectorSource | undefined): ConnectorSource {
    const normalized = String(source ?? ConnectorSource.MANUAL)
      .trim()
      .toLowerCase();
    if (normalized === ConnectorSource.TOOL || normalized === ConnectorSource.CUSTOM) {
      return ConnectorSource.MANUAL;
    }
    if (Object.values(ConnectorSource).includes(normalized as ConnectorSource)) {
      return normalized as ConnectorSource;
    }
    return ConnectorSource.MANUAL;
  }

  private normalizeAuthConfig(value: unknown): AgentConnector["authConfig"] {
    if (!this.isObject(value)) {
      return null;
    }

    const rawType = String(value.type ?? "none").trim().toLowerCase();
    const type =
      rawType === "api_key" ||
      rawType === "bearer" ||
      rawType === "basic" ||
      rawType === "oauth2"
        ? rawType
        : "none";
    const credentials = this.isObject(value.credentials)
      ? value.credentials
      : null;

    return {
      type,
      credentials: credentials as any,
    };
  }

  private normalizeOperations(raw: unknown): ConnectorOperation[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    const usedIds = new Set<string>();
    return raw
      .filter((operation) => operation && typeof operation === "object")
      .map((operation, index) => {
        const value = this.ensureRecord(operation);
        const method = this.normalizeHttpMethod(value.method);
        const path =
          String(value.path ?? value.url ?? "").trim() || `/operation/${index + 1}`;
        const id = this.ensureUniqueOperationId(
          String(value.id ?? value.operationId ?? value.name ?? `operation_${index + 1}`),
          usedIds,
        );
        const name = String(value.name ?? id).trim();
        const isDestructive =
          value.isDestructive === undefined
            ? method !== ConnectorHttpMethod.GET
            : Boolean(value.isDestructive);
        const permissionLevel = this.normalizePermissionLevel(
          value.permissionLevel,
          isDestructive,
        );
        const parameters = this.normalizeOperationParameters(value.parameters);
        const requestBodySchema = this.isObject(value.requestBodySchema)
          ? (value.requestBodySchema as Record<string, unknown>)
          : this.isObject(value.bodySchema)
            ? (value.bodySchema as Record<string, unknown>)
            : null;
        const headers = this.normalizeStringRecord(value.headers);

        return {
          id,
          name,
          method,
          path,
          url: String(value.url ?? path),
          description: String(
            value.description ??
              `${method} ${path} connector operation`,
          ),
          parameters,
          requestBodySchema,
          bodySchema: requestBodySchema,
          headers,
          dependsOn: Array.isArray(value.dependsOn)
            ? value.dependsOn
                .map((entry) => String(entry ?? "").trim())
                .filter(Boolean)
            : undefined,
          auth_ref:
            typeof value.auth_ref === "string" ? value.auth_ref : undefined,
          env_refs: this.normalizeEnvRefs(value.env_refs as unknown[]),
          isDestructive,
          isExposed:
            value.isExposed === undefined
              ? !isDestructive
              : Boolean(value.isExposed),
          permissionLevel,
          toolId:
            typeof value.toolId === "string"
              ? value.toolId
              : typeof value.tool_id === "string"
                ? value.tool_id
                : null,
        } as ConnectorOperation;
      });
  }

  private normalizeOperationParameters(
    raw: unknown,
  ): ConnectorOperation["parameters"] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const value = this.ensureRecord(item);
        const location = String(value.in ?? "query").toLowerCase();
        return {
          name: String(value.name ?? "").trim(),
          in:
            location === "path" ||
            location === "query" ||
            location === "header" ||
            location === "body"
              ? (location as "path" | "query" | "header" | "body")
              : "query",
          type: String(value.type ?? "string"),
          description: String(value.description ?? "Connector parameter"),
          required: Boolean(value.required),
          enum: Array.isArray(value.enum)
            ? value.enum.map((entry) => String(entry))
            : undefined,
          dependsOnParam:
            typeof value.dependsOnParam === "string"
              ? value.dependsOnParam
              : undefined,
        };
      })
      .filter((param) => param.name.length > 0);
  }

  private normalizePermissionLevel(
    value: unknown,
    isDestructive: boolean,
  ): ConnectorOperation["permissionLevel"] {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (
      normalized === "always_allow" ||
      normalized === "needs_approval" ||
      normalized === "never_allow"
    ) {
      return normalized;
    }
    return isDestructive ? "needs_approval" : "always_allow";
  }

  private normalizeStringRecord(value: unknown): Record<string, string> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
      (accumulator, [key, entry]) => {
        if (typeof entry === "string") {
          accumulator[key] = entry;
        }
        return accumulator;
      },
      {},
    );
  }

  private normalizeEnvRefs(raw: unknown): Array<{ field: string; env_key: string; fallback?: string }> {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => {
        const value = this.ensureRecord(entry);
        return {
          field: String(value.field ?? "").trim(),
          env_key: String(value.env_key ?? value.envKey ?? "").trim(),
          fallback:
            typeof value.fallback === "string" ? value.fallback : undefined,
        };
      })
      .filter((entry) => entry.field && entry.env_key);
  }

  private buildConnectorGraph(operations: ConnectorOperation[]) {
    const validIds = new Set(operations.map((operation) => operation.id));
    const edges = operations.flatMap((operation) =>
      (operation.dependsOn ?? [])
        .filter((dependency) => validIds.has(dependency))
        .map((dependency) => ({ from: dependency, to: operation.id })),
    );

    return {
      nodes: operations.map((operation) => operation.id),
      edges,
    };
  }

  private normalizeHttpMethod(value: unknown): ConnectorHttpMethod {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (Object.values(ConnectorHttpMethod).includes(normalized as ConnectorHttpMethod)) {
      return normalized as ConnectorHttpMethod;
    }
    return ConnectorHttpMethod.POST;
  }

  private ensureUniqueOperationId(raw: string, usedIds: Set<string>) {
    const base = this.normalizeName(raw) || "operation";
    let candidate = base;
    let counter = 2;
    while (usedIds.has(candidate)) {
      candidate = `${base}_${counter}`;
      counter += 1;
    }
    usedIds.add(candidate);
    return candidate;
  }

  private async resolveUniqueConnectorSlug(
    agentId: string,
    rawValue: string,
  ): Promise<string> {
    const base = this.slugify(rawValue) || `connector-${Date.now()}`;
    let candidate = base;
    let counter = 2;

    while (true) {
      const existing = await this.agentConnectorRepository.findByAgentAndSlug(
        agentId,
        candidate,
      );
      if (!existing) {
        return candidate;
      }
      candidate = `${base}-${counter}`;
      counter += 1;
    }
  }

  private async assertAgentExists(agentId: string) {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }
    return agent;
  }

  private normalizePlatformConnectorKey(raw: string) {
    const key = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!key) {
      throw new Error("Platform connector key is required.");
    }
    return key.slice(0, 255);
  }

  private normalizeName(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  private ensureRecord(value: unknown): Record<string, unknown> {
    return this.isObject(value) ? value : {};
  }

}
