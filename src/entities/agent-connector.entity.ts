import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Agent } from "./agent.entity";
import { AuditableEntity } from "./base/auditable.entity";
import { ConnectorArgumentMode } from "./enums/connector-argument-mode.enum";
import { ConnectorHttpMethod } from "./enums/connector-http-method.enum";
import { ConnectorSource } from "./enums/connector-source.enum";
import { PlatformConnector } from "./platform-connector.entity";

export type ConnectorParamLocation = "query" | "path" | "header" | "body";
export type ConnectorPermissionLevel =
  | "always_allow"
  | "needs_approval"
  | "never_allow";

export type ConnectorOperationParam = {
  name: string;
  in: ConnectorParamLocation;
  type: string;
  description: string;
  required: boolean;
  enum?: string[];
  dependsOnParam?: string;
};

export type ConnectorEnvRef = {
  field: string;
  env_key: string;
  fallback?: string;
};

export type ConnectorOperation = {
  id: string;
  name: string;
  method: ConnectorHttpMethod;
  path: string;
  url?: string;
  description: string;
  parameters: ConnectorOperationParam[];
  requestBodySchema?: Record<string, unknown> | null;
  bodySchema?: Record<string, unknown> | null;
  headers?: Record<string, string>;
  auth_ref?: string;
  env_refs?: ConnectorEnvRef[];
  dependsOn?: string[];
  isDestructive: boolean;
  isExposed: boolean;
  permissionLevel: ConnectorPermissionLevel;
  toolId?: string | null;
};

export type ConnectorAuthCredential =
  | {
      source: "inline";
      value?: string;
      username?: string;
      password?: string;
      keyName?: string;
      injectTo?: "header" | "query";
    }
  | {
      source: "env";
      key: string;
      usernameKey?: string;
      passwordKey?: string;
      keyName?: string;
      injectTo?: "header" | "query";
    };

export type ConnectorAuthConfig = {
  type: "none" | "api_key" | "bearer" | "basic" | "oauth2";
  credentials?: ConnectorAuthCredential | null;
};

export type ConnectorGraph = {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
};

@Entity("agent_connectors")
@Index("IDX_agent_connectors_agent_slug", ["agentId", "slug"], { unique: true })
export class AgentConnector extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid" })
  @Index()
  agentId!: string;

  @ManyToOne(() => Agent, (agent) => agent.connectors, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255 })
  slug!: string;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @Column({
    name: "http_method",
    type: "enum",
    enum: ConnectorHttpMethod,
    default: ConnectorHttpMethod.POST,
  })
  httpMethod!: ConnectorHttpMethod;

  @Column({ name: "tool_name", type: "varchar", length: 255, default: "connector_operation" })
  toolName!: string;

  @Column({ name: "tool_id", type: "uuid", nullable: true })
  toolId?: string | null;

  @Column({
    name: "argument_mode",
    type: "enum",
    enum: ConnectorArgumentMode,
    default: ConnectorArgumentMode.MIXED,
  })
  argumentMode!: ConnectorArgumentMode;

  @Column({ name: "argument_mappings", type: "json", nullable: true })
  argumentMappings?: Record<string, string> | null;

  @Column({ name: "default_args", type: "json", nullable: true })
  defaultArgs?: Record<string, unknown> | null;

  @Column({ name: "request_schema", type: "json", nullable: true })
  requestSchema?: Record<string, unknown> | null;

  @Column({ name: "is_exposed", type: "boolean", default: true })
  isExposed!: boolean;

  @Column({ name: "enabled", type: "boolean", default: true })
  enabled!: boolean;

  @Column({
    type: "enum",
    enum: ConnectorSource,
    default: ConnectorSource.MANUAL,
  })
  source!: ConnectorSource;

  @Column({ name: "source_metadata", type: "json", nullable: true })
  sourceMetadata?: Record<string, unknown> | null;

  @Column({ name: "raw_import", type: "json", nullable: true })
  rawImport?: Record<string, unknown> | null;

  @Column({ name: "enriched_import", type: "json", nullable: true })
  enrichedImport?: Record<string, unknown> | null;

  @Column({ name: "auth_config", type: "json", nullable: true })
  authConfig?: ConnectorAuthConfig | null;

  @Column({ name: "operations", type: "json", nullable: true })
  operations?: ConnectorOperation[] | null;

  @Column({ name: "dependency_graph", type: "json", nullable: true })
  dependencyGraph?: ConnectorGraph | null;

  @Column({ name: "env_config", type: "json", nullable: true })
  envConfig?: Record<string, string> | null;

  @Column({ name: "env_refs", type: "json", nullable: true })
  envRefs?: ConnectorEnvRef[] | null;

  @Column({ name: "auth_ref", type: "varchar", length: 255, nullable: true })
  authRef?: string | null;

  @Column({ name: "logo_url", type: "varchar", length: 1000, nullable: true })
  logoUrl?: string | null;

  @Column({ name: "is_live", type: "boolean", default: false })
  isLive!: boolean;

  @Column({ name: "is_public", type: "boolean", default: false })
  isPublic!: boolean;

  @Column({ name: "platform_connector_id", type: "uuid", nullable: true })
  platformConnectorId?: string | null;

  @ManyToOne(() => PlatformConnector, (platformConnector) => platformConnector.agentConnectors, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "platform_connector_id" })
  platformConnector?: PlatformConnector | null;
}
