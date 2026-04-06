import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { Agent } from "./agent.entity";
import { AuditableEntity } from "./base/auditable.entity";
import { AgentConversationMessage } from "./agent-conversation-message.entity";
import { AgentConversationVersion } from "./agent-conversation-version.entity";

@Entity("agent_conversations")
export class AgentConversation extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid" })
  @Index()
  agentId!: string;

  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent;

  @Column({ name: "session_id", type: "varchar", length: 255, nullable: true })
  @Index()
  sessionId?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  title?: string | null;

  @Column({ name: "current_version_number", type: "int", default: 1 })
  currentVersionNumber!: number;

  @Column({ type: "json", nullable: true })
  state?: Record<string, unknown> | null;

  @OneToMany(() => AgentConversationVersion, (version) => version.conversation)
  versions!: AgentConversationVersion[];

  @OneToMany(() => AgentConversationMessage, (message) => message.conversation)
  messages!: AgentConversationMessage[];
}
