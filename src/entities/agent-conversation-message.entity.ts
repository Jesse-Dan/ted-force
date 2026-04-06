import type { ModelMessage } from "ai";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { AgentConversation } from "./agent-conversation.entity";
import { AgentConversationVersion } from "./agent-conversation-version.entity";
import { AuditableEntity } from "./base/auditable.entity";
import { RuntimeRun } from "./runtime-run.entity";

export type ConversationMessageRole = "system" | "user" | "assistant" | "tool";

@Entity("agent_conversation_messages")
@Index(["conversationId", "conversationVersionId", "sequence"], { unique: true })
export class AgentConversationMessage extends AuditableEntity {
  @Column({ name: "conversation_id", type: "uuid" })
  @Index()
  conversationId!: string;

  @ManyToOne(() => AgentConversation, (conversation) => conversation.messages, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversation_id" })
  conversation!: AgentConversation;

  @Column({ name: "conversation_version_id", type: "uuid" })
  @Index()
  conversationVersionId!: string;

  @ManyToOne(() => AgentConversationVersion, (version) => version.messages, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversation_version_id" })
  version!: AgentConversationVersion;

  @Column({ name: "run_id", type: "uuid", nullable: true })
  @Index()
  runId?: string | null;

  @ManyToOne(() => RuntimeRun, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "run_id" })
  run?: RuntimeRun | null;

  @Column({ type: "varchar", length: 20 })
  role!: ConversationMessageRole;

  @Column({ type: "int" })
  sequence!: number;

  @Column({ type: "longtext", nullable: true })
  text?: string | null;

  @Column({ name: "model_message", type: "json", nullable: true })
  modelMessage?: ModelMessage | null;

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, unknown> | null;
}
