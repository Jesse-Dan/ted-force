import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { Agent } from "./agent.entity";
import { AuditableEntity } from "./base/auditable.entity";
import { RuntimeMessage } from "./runtime-message.entity";

export interface RunStats {
  messages: number;
  functionsCalled: number;
  avgResponse: number;
  errors: number;
}

export interface RunErrorEntry {
  message: string;
  timestamp: string;
}

@Entity("runtime_runs")
export class RuntimeRun extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid" })
  @Index()
  agentId!: string;

  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent;

  @Column({ type: "varchar", length: 255 })
  @Index()
  name!: string;

  @Column({ name: "kind", type: "varchar", length: 50, default: "live" })
  @Index()
  kind!: string;

  @Column({ name: "instance_name", type: "varchar", length: 500 })
  instanceName!: string;

  @Column({ name: "is_running", type: "boolean", default: false })
  isRunning!: boolean;

  @Column({ name: "session_id", type: "varchar", length: 255, nullable: true })
  @Index()
  sessionId?: string | null;

  @Column({ name: "is_default", type: "boolean", default: false })
  isDefault!: boolean;

  @Column({ name: "conversation_id", type: "uuid", nullable: true })
  conversationId?: string | null;

  @Column({ name: "conversation_version_id", type: "uuid", nullable: true })
  conversationVersionId?: string | null;

  @Column({ type: "json", nullable: true })
  stats?: RunStats | null;

  @Column({ name: "error_logs", type: "json", nullable: true })
  errorLogs?: RunErrorEntry[] | null;

  @OneToMany(() => RuntimeMessage, (message) => message.run, { cascade: true })
  messages!: RuntimeMessage[];
}
