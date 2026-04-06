import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Agent } from "./agent.entity";
import { AuditableEntity } from "./base/auditable.entity";

@Entity("awareness_records")
export class AwarenessRecord extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid", nullable: true })
  @Index()
  agentId?: string | null;

  @ManyToOne(() => Agent, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "agent_id" })
  agent?: Agent | null;

  @Column({ name: "session_id", type: "varchar", length: 255, nullable: true })
  sessionId?: string | null;

  @Column({ type: "int", default: 1 })
  used!: number;

  @Column({ type: "simple-array", nullable: true })
  context?: string[];
}
