import { Column, Entity, JoinColumn, OneToMany, OneToOne } from "typeorm";
import { AgentParameter } from "./agent-parameter.entity";
import { AuditableEntity } from "./base/auditable.entity";
import { CapabilityToolPolicy } from "./capability-tool-policy.entity";

export interface CapabilityFlags {
  thinking: boolean;
  toolUse: boolean;
  functionCalling: boolean;
  functionMemory: boolean;
}

@Entity("capability_profiles")
export class CapabilityProfile extends AuditableEntity {
  @Column({ name: "agent_parameter_id", type: "uuid" })
  agentParameterId!: string;

  @Column({ name: "capability_flags", type: "json" })
  capabilityFlags!: CapabilityFlags;

  @Column({ type: "simple-array", nullable: true })
  restrictions?: string[];

  @OneToOne(() => AgentParameter, (agentParameter) => agentParameter.capabilityProfile, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_parameter_id" })
  agentParameter!: AgentParameter;

  @OneToMany(() => CapabilityToolPolicy, (policy) => policy.capabilityProfile, {
    cascade: true,
  })
  toolPolicies!: CapabilityToolPolicy[];
}
