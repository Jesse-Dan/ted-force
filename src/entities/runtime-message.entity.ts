import type { ModelMessage, UIMessage } from "ai";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { RuntimeRun } from "./runtime-run.entity";

export type RuntimeMessageRole = "user" | "assistant" | "system" | "tool";

@Entity("runtime_messages")
export class RuntimeMessage extends AuditableEntity {
  @Column({ name: "message_key", type: "uuid", unique: true, generated: "uuid" })
  messageKey!: string;

  @Column({ name: "run_id", type: "uuid", nullable: true })
  @Index()
  runId?: string | null;

  @ManyToOne(() => RuntimeRun, (run) => run.messages, {
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "run_id" })
  run?: RuntimeRun | null;

  @Column({ type: "varchar", length: 20 })
  role!: RuntimeMessageRole;

  @Column({ name: "model_message", type: "json", nullable: true })
  modelMessage?: ModelMessage | null;

  @Column({ name: "ui_message", type: "json", nullable: true })
  uiMessage?: UIMessage | null;

  @Column({ name: "conversation_id", type: "uuid", nullable: true })
  conversationId?: string | null;

  @Column({ name: "session_id", type: "varchar", length: 255, nullable: true })
  sessionId?: string | null;

  @Column({ name: "metadata", type: "json", nullable: true })
  metadata?: Record<string, unknown> | null;
}
