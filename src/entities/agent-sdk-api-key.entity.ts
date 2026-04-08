import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Agent } from "./agent.entity";
import { AuditableEntity } from "./base/auditable.entity";

@Entity("agent_sdk_api_keys")
export class AgentSdkApiKey extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid" })
  @Index()
  agentId!: string;

  @ManyToOne(() => Agent, (agent) => agent.sdkApiKeys, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent;

  @Column({ name: "name", type: "varchar", length: 255 })
  name!: string;

  @Column({ name: "key_prefix", type: "varchar", length: 32 })
  keyPrefix!: string;

  @Column({ name: "key_mask", type: "varchar", length: 64 })
  keyMask!: string;

  @Column({ name: "token_hash", type: "varchar", length: 128 })
  @Index({ unique: true })
  tokenHash!: string;

  @Column({ name: "scopes", type: "json" })
  scopes!: string[];

  @Column({ name: "last_used_at", type: "timestamp", nullable: true })
  lastUsedAt?: Date | null;

  @Column({ name: "revoked_at", type: "timestamp", nullable: true })
  revokedAt?: Date | null;

  @Column({ name: "created_by_user_id", type: "varchar", length: 255, nullable: true })
  createdByUserId?: string | null;
}
