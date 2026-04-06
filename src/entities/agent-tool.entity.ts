import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Agent } from "./agent.entity";
import { AuditableEntity } from "./base/auditable.entity";
import { ToolConcurrencyHint } from "./enums/tool-concurrency-hint.enum";
import { ToolCostTier } from "./enums/tool-cost-tier.enum";
import { ToolFailureStrategy } from "./enums/tool-failure-strategy.enum";
import { ToolMemoryModel } from "./enums/tool-memory-model.enum";
import { ToolPriority } from "./enums/tool-priority.enum";
import { ToolTriggerType } from "./enums/tool-trigger-type.enum";
import { AgentInstance } from "./agent-instance.entity";

export interface ToolSchema {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface ToolExecutionPolicy {
  priority: ToolPriority;
  concurrencyHint: ToolConcurrencyHint;
  failureStrategy: ToolFailureStrategy;
}

export interface ToolStateManagement {
  memoryModel: ToolMemoryModel;
  lifetimeSeconds?: number;
  sharedContextId?: string;
}

export interface ToolSafetyPolicy {
  costTier: ToolCostTier;
  requiresConfirmation: boolean;
}

export interface ToolTrigger {
  type: ToolTriggerType;
  source?: string;
}

@Entity("agent_tools")
export class AgentTool extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid", nullable: true })
  @Index()
  agentId?: string | null;

  @ManyToOne(() => Agent, (agent) => agent.tools, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_id" })
  agent?: Agent | null;

  @Column({ name: "instance_id", type: "uuid", nullable: true })
  @Index()
  instanceId?: string | null;

  @ManyToOne(() => AgentInstance, (instance) => instance.tools, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "instance_id" })
  instance?: AgentInstance | null;

  @Column("longtext")
  name!: string;

  @Column("longtext", { nullable: true })
  description?: string | null;

  @Column({ type: "json", nullable: true })
  schema?: ToolSchema | null;

  @Column("longtext", { nullable: true })
  code?: string | null;

  @Column({ default: true })
  enabled!: boolean;

  @Column({ name: "last_tested_at", type: "timestamp", nullable: true })
  lastTestedAt?: Date | null;

  @Column({ name: "execution_policy", type: "json", nullable: true })
  executionPolicy?: ToolExecutionPolicy | null;

  @Column({ name: "state_management", type: "json", nullable: true })
  stateManagement?: ToolStateManagement | null;

  @Column({ name: "safety_policy", type: "json", nullable: true })
  safetyPolicy?: ToolSafetyPolicy | null;

  @Column({ name: "trigger", type: "json", nullable: true })
  trigger?: ToolTrigger | null;

  @Column({ name: "commit_hash", type: "varchar", length: 255, nullable: true })
  commitHash?: string | null;
}
