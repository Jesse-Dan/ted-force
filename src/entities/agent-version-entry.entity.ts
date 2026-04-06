import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { AgentInstance } from "./agent-instance.entity";

export interface VersionEntryAuthor {
  userName?: string;
  userId?: string;
}

export interface VersionEntryMetadata {
  git?: {
    status?: "pending" | "success" | "failed";
    pushed?: boolean;
    syncedAt?: string | null;
    message?: string | null;
    remoteUrl?: string | null;
    branch?: string | null;
    nativeCommitHash?: string | null;
  } | null;
  branch?: {
    id?: string | null;
    name?: string | null;
    isDefault?: boolean;
  } | null;
  parentCommitHash?: string | null;
  snapshot?: Record<string, unknown> | null;
  files?: Array<{
    path: string;
    content: string;
  }> | null;
}

@Entity("agent_version_entries")
export class AgentVersionEntry extends AuditableEntity {
  @Column({ type: "varchar", length: 50 })
  version!: string;

  @Column({ name: "instance_id", type: "uuid", nullable: true })
  @Index()
  instanceId?: string | null;

  @ManyToOne(() => AgentInstance, (instance) => instance.versionEntries, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "instance_id" })
  instance?: AgentInstance | null;

  @Column({ type: "timestamp" })
  releasedAt!: Date;

  @Column("longtext", { nullable: true })
  message?: string | null;

  @Column({ name: "commit_hash", type: "varchar", length: 255, nullable: true })
  commitHash?: string | null;

  @Column({ type: "json", nullable: true })
  author?: VersionEntryAuthor | null;

  @Column({ type: "json", nullable: true })
  metadata?: VersionEntryMetadata | null;
}
