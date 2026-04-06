import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { Agent } from "./agent.entity";
import { ModelFamily } from "./enums/model-family.enum";
import { ModelProvider } from "./enums/model-provider.enum";

export interface RuntimeLimits {
  requestsPerMinute: number;
  tokenLimit: number;
  tokensUsed: number;
}

export interface AccessPolicy {
  ipWhitelist: string[];
  allowedOrigins: string[];
  httpsEnabled: boolean;
  apiKeyRotationDays: number;
}

export const DEFAULT_RUNTIME_LIMITS: RuntimeLimits = {
  requestsPerMinute: 40,
  tokenLimit: 0,
  tokensUsed: 0,
};

export const DEFAULT_ACCESS_POLICY: AccessPolicy = {
  ipWhitelist: [],
  allowedOrigins: [],
  httpsEnabled: true,
  apiKeyRotationDays: 0,
};

@Entity("agent_configs")
export class AgentConfig extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid" })
  agentId!: string;

  @OneToOne(() => Agent, (agent) => agent.config, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent;

  @Column({ name: "api_key", type: "varchar", length: 255, nullable: true })
  apiKey?: string | null;

  @Column({ name: "system_api_key", type: "varchar", length: 255, nullable: true })
  systemApiKey?: string | null;

  @Column({
    name: "provider",
    type: "enum",
    enum: ModelProvider,
    default: ModelProvider.GEMINI,
  })
  provider!: ModelProvider;

  @Column({
    name: "model",
    type: "enum",
    enum: ModelFamily,
    default: ModelFamily.GEMINI_2_5_FLASH_LITE,
  })
  model!: ModelFamily;

  @Column({ name: "temperature", type: "float", default: 0.7 })
  temperature!: number;

  @Column({ name: "max_tokens", type: "int", default: 2048 })
  maxTokens!: number;

  @Column({ name: "top_p", type: "float", default: 1 })
  topP!: number;

  @Column({ name: "top_k", type: "int", default: 50 })
  topK!: number;

  @Column({ name: "is_system_healthy", type: "boolean", default: true })
  isSystemHealthy!: boolean;

  @Column({ name: "last_security_audit_at", type: "timestamp", nullable: true })
  lastSecurityAuditAt?: Date | null;

  @Column({
    name: "runtime_limits",
    type: "json",
    nullable: true,
  })
  runtimeLimits?: RuntimeLimits | null;

  @Column({
    name: "access_policy",
    type: "json",
    nullable: true,
  })
  accessPolicy?: AccessPolicy | null;
}
