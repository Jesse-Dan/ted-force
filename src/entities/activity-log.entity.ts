import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Agent } from "./agent.entity";
import { AuditableEntity } from "./base/auditable.entity";

@Entity("activity_logs")
export class ActivityLog extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid", nullable: true })
  @Index()
  agentId?: string | null;

  @ManyToOne(() => Agent, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "agent_id" })
  agent?: Agent | null;

  @Column({ type: "json", nullable: true })
  entry?: Record<string, unknown> | null;
}
