import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { Agent } from "./agent.entity";

@Entity("agent_environment_variables")
export class AgentEnvironmentVariable extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid" })
  @Index()
  agentId!: string;

  @ManyToOne(() => Agent, (agent) => agent.environmentVariables, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent;

  @Column({ type: "varchar", length: 255 })
  key!: string;

  @Column({ type: "text" })
  value!: string;

  @Column({ name: "is_secret", type: "boolean", default: true })
  isSecret!: boolean;

  @Column({ name: "description", type: "varchar", length: 255, nullable: true })
  description?: string | null;
}
