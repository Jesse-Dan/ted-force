import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { AgentConversation } from "./agent-conversation.entity";
import { AgentConversationMessage } from "./agent-conversation-message.entity";

@Entity("agent_conversation_versions")
@Index(["conversationId", "versionNumber"], { unique: true })
export class AgentConversationVersion extends AuditableEntity {
  @Column({ name: "conversation_id", type: "uuid" })
  @Index()
  conversationId!: string;

  @ManyToOne(() => AgentConversation, (conversation) => conversation.versions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversation_id" })
  conversation!: AgentConversation;

  @Column({ name: "version_number", type: "int" })
  versionNumber!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  label?: string | null;

  @Column({ type: "json", nullable: true })
  metadata?: Record<string, unknown> | null;

  @OneToMany(() => AgentConversationMessage, (message) => message.version)
  messages!: AgentConversationMessage[];
}
