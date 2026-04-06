import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Agent } from "./agent.entity";
import { AuditableEntity } from "./base/auditable.entity";

export enum AssetType {
  IMAGE = "image",
  VIDEO = "video",
  DOCUMENT = "document",
  MODEL = "model",
  OTHER = "other",
}

@Entity("assets")
export class Asset extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid", nullable: true })
  agentId?: string | null;

  @ManyToOne(() => Agent, (agent) => agent.assets, {
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "agent_id" })
  agent?: Agent | null;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Index()
  @Column({
    type: "enum",
    enum: AssetType,
    default: AssetType.OTHER,
  })
  type!: AssetType;

  @Column({ type: "bigint" })
  size!: number;

  @Column({ type: "varchar", length: 2048 })
  url!: string;

  @Column({ type: "simple-array", nullable: true })
  tags?: string[];
}
