import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { AgentParameter } from "./agent-parameter.entity";

export type RulePreset = "balanced" | "strict" | "creative";

@Entity("context_rule_sets")
export class ContextRuleSet extends AuditableEntity {
  @Column({ name: "agent_parameter_id", type: "uuid" })
  agentParameterId!: string;

  @Column({ type: "varchar", length: 36, default: "balanced" })
  preset!: RulePreset;

  @Column({ name: "history_depth", type: "int", default: 5 })
  historyDepth!: number;

  @Column({ name: "persistent_memory", type: "boolean", default: false })
  persistentMemory!: boolean;

  @Column({ name: "custom_behavioral_rules", type: "simple-array", nullable: true })
  customBehavioralRules?: string[];

  @OneToOne(() => AgentParameter, (agentParameter) => agentParameter.contextRuleSet, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_parameter_id" })
  agentParameter!: AgentParameter;
}
