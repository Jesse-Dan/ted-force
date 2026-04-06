import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { Organization } from "./organization.entity";

@Entity("organization_repository_connections")
export class OrganizationRepositoryConnection extends AuditableEntity {
  @Column({ name: "organization_id", type: "uuid", unique: true })
  organizationId!: string;

  @OneToOne(() => Organization, (organization) => organization.repositoryConnection, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "organization_id" })
  organization!: Organization;

  @Column({ name: "is_enabled", type: "boolean", default: true })
  isEnabled!: boolean;

  @Column({ type: "varchar", length: 64, default: "github" })
  provider!: string;

  @Column({ name: "github_login", type: "varchar", length: 255, nullable: true })
  githubLogin?: string | null;

  @Column({ name: "github_avatar_url", type: "varchar", length: 2048, nullable: true })
  githubAvatarUrl?: string | null;

  @Column({ name: "default_branch", type: "varchar", length: 255, nullable: true })
  defaultBranch?: string | null;

  @Column({ name: "access_token", type: "text", nullable: true })
  accessToken?: string | null;

  @Column({ name: "username", type: "varchar", length: 255, nullable: true })
  username?: string | null;

  @Column({ name: "auth_type", type: "varchar", length: 32, nullable: true })
  authType?: string | null;

  @Column({ name: "app_installation_id", type: "int", nullable: true })
  appInstallationId?: number | null;

  @Column({ name: "app_client_id", type: "varchar", length: 255, nullable: true })
  appClientId?: string | null;

  @Column({ name: "connected_at", type: "varchar", length: 255, nullable: true })
  connectedAt?: string | null;
}
