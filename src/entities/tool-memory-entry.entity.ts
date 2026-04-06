import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { AgentTool } from "./agent-tool.entity";
import { AuditableEntity } from "./base/auditable.entity";

@Entity("tool_memory_entries")
export class ToolMemoryEntry extends AuditableEntity {
  @Column({ name: "agent_tool_id", type: "uuid" })
  @Index()
  agentToolId!: string;

  @ManyToOne(() => AgentTool, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_tool_id" })
  agentTool!: AgentTool;

  @Column({ name: "shared_memory_id", type: "varchar", length: 255, nullable: true })
  sharedMemoryId?: string | null;

  @Column({ type: "json", nullable: true })
  data?: Record<string, unknown> | null;
}
