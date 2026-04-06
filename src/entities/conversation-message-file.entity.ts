import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { AgentConversationMessage } from "./agent-conversation-message.entity";
import { AuditableEntity } from "./base/auditable.entity";
import { StoredFile } from "./stored-file.entity";

@Entity("conversation_message_files")
@Index(["conversationMessageId", "storedFileId"], { unique: true })
export class ConversationMessageFile extends AuditableEntity {
  @Column({ name: "conversation_message_id", type: "uuid" })
  @Index()
  conversationMessageId!: string;

  @ManyToOne(() => AgentConversationMessage, { onDelete: "CASCADE" })
  @JoinColumn({ name: "conversation_message_id" })
  conversationMessage!: AgentConversationMessage;

  @Column({ name: "stored_file_id", type: "uuid" })
  @Index()
  storedFileId!: string;

  @ManyToOne(() => StoredFile, { onDelete: "CASCADE" })
  @JoinColumn({ name: "stored_file_id" })
  storedFile!: StoredFile;

  @Column({ name: "attachment_label", type: "varchar", length: 255, nullable: true })
  attachmentLabel?: string | null;
}
