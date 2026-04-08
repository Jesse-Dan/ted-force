import { Column, Entity, OneToMany } from "typeorm";
import { AgentConnector } from "./agent-connector.entity";
import { AuditableEntity } from "./base/auditable.entity";

@Entity("platform_connectors")
export class PlatformConnector extends AuditableEntity {
  @Column({ type: "varchar", length: 255, unique: true })
  key!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255, default: "generic" })
  provider!: string;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @Column({ type: "varchar", length: 255, default: "General" })
  category!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "is_official", type: "boolean", default: true })
  isOfficial!: boolean;

  @Column({ name: "version", type: "varchar", length: 64, default: "1.0.0" })
  version!: string;

  @Column({ name: "upload_id", type: "varchar", length: 255, nullable: true })
  uploadId?: string | null;

  @Column({ name: "upload_source", type: "varchar", length: 255, nullable: true })
  uploadSource?: string | null;

  @Column({ name: "logo_url", type: "varchar", length: 1000, nullable: true })
  logoUrl?: string | null;

  @Column({ type: "json", nullable: true })
  definition?: Record<string, unknown> | null;

  @OneToMany(() => AgentConnector, (connector) => connector.platformConnector)
  agentConnectors!: AgentConnector[];
}
