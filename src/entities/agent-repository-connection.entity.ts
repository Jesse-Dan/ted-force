import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { Agent } from "./agent.entity";

@Entity("agent_repository_connections")
export class AgentRepositoryConnection extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid", unique: true })
  agentId!: string;

  @OneToOne(() => Agent, (agent) => agent.repositoryConnection, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent;

  @Column({ name: "is_enabled", type: "boolean", default: true })
  isEnabled!: boolean;

  @Column({ type: "varchar", length: 64, default: "github" })
  provider!: string;

  @Column({ name: "connection_source", type: "varchar", length: 32, default: "agent" })
  connectionSource!: string;

  @Column({ name: "github_login", type: "varchar", length: 255, nullable: true })
  githubLogin?: string | null;

  @Column({ name: "github_avatar_url", type: "varchar", length: 2048, nullable: true })
  githubAvatarUrl?: string | null;

  @Column({ name: "repository_url", type: "varchar", length: 2048, nullable: true })
  repositoryUrl?: string | null;

  @Column({ name: "repo_name", type: "varchar", length: 255, nullable: true })
  repoName?: string | null;

  @Column({ name: "default_branch", type: "varchar", length: 255, nullable: true })
  defaultBranch?: string | null;

  @Column({ name: "installation_type", type: "varchar", length: 32, nullable: true })
  installationType?: string | null;

  @Column({ name: "access_token", type: "text", nullable: true })
  accessToken?: string | null;

  @Column({ name: "refresh_token", type: "text", nullable: true })
  refreshToken?: string | null;

  @Column({ name: "token_expires_at", type: "varchar", length: 255, nullable: true })
  tokenExpiresAt?: string | null;

  @Column({ name: "username", type: "varchar", length: 255, nullable: true })
  username?: string | null;

  @Column({ name: "app_installation_id", type: "int", nullable: true })
  appInstallationId?: number | null;

  @Column({ name: "app_client_id", type: "varchar", length: 255, nullable: true })
  appClientId?: string | null;

  @Column({ name: "app_installation_url", type: "varchar", length: 2048, nullable: true })
  appInstallationUrl?: string | null;

  @Column({ name: "app_installations", type: "json", nullable: true })
  appInstallations?: Array<Record<string, unknown>> | null;

  @Column({ type: "varchar", length: 32, nullable: true })
  visibility?: string | null;

  @Column({ name: "auto_create_repository", type: "boolean", default: true })
  autoCreateRepository!: boolean;

  @Column({ name: "commit_mode", type: "varchar", length: 32, nullable: true })
  commitMode?: string | null;

  @Column({ name: "connected_at", type: "varchar", length: 255, nullable: true })
  connectedAt?: string | null;
}
