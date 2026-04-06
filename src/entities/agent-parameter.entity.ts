import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from "typeorm";
import { Agent } from "./agent.entity";
import { AgentInstance } from "./agent-instance.entity";
import { AuditableEntity } from "./base/auditable.entity";
import { CapabilityProfile } from "./capability-profile.entity";
import { ContextRuleSet } from "./context-rule-set.entity";
import { VoiceProfile } from "./voice-profile.entity";

export type ResponseType = "json" | "xml" | "text" | "markdown" | "auto";

export interface ResponseFormat {
  type: ResponseType;
  schema?: object;
}

export interface AgentNiche {
  name?: string;
  gender?: string;
  rating?: number;
}

@Entity("agent_parameters")
export class AgentParameter extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid" })
  @Index()
  agentId!: string;

  @ManyToOne(() => Agent, (agent) => agent.parameters, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent;

  @Column({ name: "instance_id", type: "uuid", nullable: true })
  @Index()
  instanceId?: string | null;

  @ManyToOne(() => AgentInstance, {
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "instance_id" })
  instance?: AgentInstance | null;

  @Column({ type: "simple-array", nullable: true })
  persona?: string[];

  @Column({ type: "json", nullable: true })
  niche?: AgentNiche | null;

  @Column("longtext", { nullable: true })
  overview?: string | null;

  @Column("longtext", { nullable: true })
  documentation?: string | null;

  @Column({ name: "core_prompts", type: "simple-array", nullable: true })
  corePrompts?: string[];

  @Column({ name: "response_format", type: "json" })
  responseFormat!: ResponseFormat;

  @Column({ name: "commit_hash", type: "varchar", length: 255, nullable: true })
  commitHash?: string | null;

  @OneToOne(() => VoiceProfile, (voiceProfile) => voiceProfile.agentParameter, {
    cascade: true,
  })
  voiceProfile!: VoiceProfile;

  @OneToOne(
    () => CapabilityProfile,
    (capabilityProfile) => capabilityProfile.agentParameter,
    { cascade: true },
  )
  capabilityProfile!: CapabilityProfile;

  @OneToOne(() => ContextRuleSet, (contextRuleSet) => contextRuleSet.agentParameter, {
    cascade: true,
  })
  contextRuleSet!: ContextRuleSet;
}
