import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { Agent } from "./agent.entity";
import { SoftDeletableEntity } from "./base/soft-deletable.entity";
import { InstanceProjection } from "./enums/instance-projection.enum";
import { InstanceReference } from "./enums/instance-reference.enum";
import { InstanceStatus } from "./enums/instance-status.enum";
import { AgentTool } from "./agent-tool.entity";
import { AgentVersionEntry } from "./agent-version-entry.entity";

export interface AgentInstanceVersion {
  version: string;
  apiUrl: string;
  guiUrl?: string;
  deployedAt: string;
  gitBranch?: string;
}

@Entity("agent_instances")
export class AgentInstance extends SoftDeletableEntity {
  @Column({ name: "agent_id", type: "uuid" })
  @Index()
  agentId!: string;

  @ManyToOne(() => Agent, (agent) => agent.instances, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent;

  @Column({ type: "json" })
  version!: AgentInstanceVersion;

  @Column({ type: "enum", enum: InstanceStatus, default: InstanceStatus.ACTIVE })
  status!: InstanceStatus;

  @Column({
    name: "projection",
    type: "enum",
    enum: InstanceProjection,
    default: InstanceProjection.ARCHIVED,
  })
  projection!: InstanceProjection;

  @Column({ type: "enum", enum: InstanceReference, nullable: true })
  reference?: InstanceReference | null;

  @Column({ name: "commit_hash", type: "varchar", length: 255, nullable: true })
  commitHash?: string | null;

  @OneToMany(() => AgentVersionEntry, (versionEntry) => versionEntry.instance)
  versionEntries!: AgentVersionEntry[];

  @OneToMany(() => AgentTool, (tool) => tool.instance)
  tools!: AgentTool[];
}
