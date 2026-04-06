import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from "typeorm";
import { AgentConfig } from "./agent-config.entity";
import { AgentConversation } from "./agent-conversation.entity";
import { AgentRepositoryConnection } from "./agent-repository-connection.entity";
import { AgentAnalytics } from "./agent-analytics.entity";
import { AgentEnvironmentVariable } from "./agent-environment-variable.entity";
import { AgentInstance } from "./agent-instance.entity";
import { AgentParameter } from "./agent-parameter.entity";
import { AgentTool } from "./agent-tool.entity";
import { Asset } from "./asset.entity";
import { AuditableEntity } from "./base/auditable.entity";
import { DataSourceConnection } from "./data-source-connection.entity";
import { AgentStatus } from "./enums/agent-status.enum";
import { ExternalResource } from "./external-resource.entity";
import { Organization } from "./organization.entity";
import { StoredFile } from "./stored-file.entity";

export interface AgentDeploymentPointers {
  current?: {
    version: string;
    apiUrl: string;
    guiUrl?: string;
    deployedAt: string;
  } | null;
}

export interface AgentMetadata {
  deployed?: AgentDeploymentPointers;
  toolCount?: number;
  tags?: string[];
  repository?: {
    provider?: "github" | "gitlab" | "gitea" | "generic" | "bitbucket";
    mode?: "internal" | "git";
    localRepoPath?: string | null;
    repositoryUrl?: string | null;
    githubLogin?: string | null;
    githubAvatarUrl?: string | null;
    owner?: string | null;
    repoName?: string | null;
    slug?: string | null;
    host?: string | null;
    defaultBranch?: string | null;
    currentBranchId?: string | null;
    currentBranchName?: string | null;
    installationType?: "app" | "token" | "none" | null;
    accessToken?: string | null;
    refreshToken?: string | null;
    tokenExpiresAt?: string | null;
    username?: string | null;
    appClientId?: string | null;
    installationId?: number | null;
    appInstallationUrl?: string | null;
    appInstallations?: Array<{
      id?: number | null;
      accountLogin?: string | null;
      targetType?: string | null;
      permissions?: Record<string, unknown>;
    }> | null;
    visibility?: "private" | "public" | "internal" | null;
    autoCreateRepository?: boolean;
    commitMode?: "direct" | "pull_request" | null;
    isConnected?: boolean;
    remoteEnabled?: boolean;
    inheritsOrganizationRemote?: boolean;
    remoteSource?: "agent" | "organization" | "none" | null;
    connectedAt?: string | null;
    initializedAt?: string | null;
    lastFetchAt?: string | null;
    lastPushAt?: string | null;
    lastPullAt?: string | null;
    lastPushStatus?: "idle" | "success" | "failed" | null;
    lastPushMessage?: string | null;
    lastPullRequestUrl?: string | null;
    webUrl?: string | null;
    cloneUrlHttps?: string | null;
    cloneUrlSsh?: string | null;
    branchUrl?: string | null;
    compareUrlTemplate?: string | null;
    health?: {
      isValidUrl?: boolean;
      ownerResolved?: boolean;
      repoResolved?: boolean;
      providerSupported?: boolean;
      readyForAutomaticPush?: boolean;
    } | null;
  } | null;
  custom?: Record<string, unknown>;
}

@Entity("agents")
export class Agent extends AuditableEntity {
  @Column({ type: "varchar", length: 255, unique: true })
  name!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  slug!: string;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @Column({ name: "domain_label", type: "varchar", length: 255, nullable: true })
  domainLabel?: string | null;

  @Column({ name: "legacy_project_id", type: "varchar", length: 255, nullable: true })
  @Index({ unique: true })
  legacyProjectId?: string | null;

  @Column({
    type: "enum",
    enum: AgentStatus,
    default: AgentStatus.DRAFT,
  })
  status!: AgentStatus;

  @Column({ type: "varchar", length: 50, default: "1.0.0" })
  version!: string;

  @Column({ name: "cover_image_url", type: "varchar", length: 2048, nullable: true })
  coverImageUrl?: string | null;

  @Column({ name: "owner_user_id", type: "varchar", length: 255, nullable: true })
  @Index()
  ownerUserId?: string | null;

  @Column({ name: "organization_id", type: "uuid", nullable: true })
  @Index()
  organizationId?: string | null;

  @ManyToOne(() => Organization, (organization) => organization.agents, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "organization_id" })
  organization?: Organization | null;

  @Column({ type: "json", nullable: true })
  metadata?: AgentMetadata | null;

  @OneToOne(() => AgentConfig, (config) => config.agent, {
    cascade: true,
  })
  config!: AgentConfig;

  @OneToOne(() => AgentRepositoryConnection, (connection) => connection.agent)
  repositoryConnection?: AgentRepositoryConnection | null;

  @OneToMany(
    () => AgentEnvironmentVariable,
    (environmentVariable) => environmentVariable.agent,
  )
  environmentVariables!: AgentEnvironmentVariable[];

  @OneToMany(() => StoredFile, (file) => file.agent)
  files!: StoredFile[];

  @OneToMany(() => AgentInstance, (instance) => instance.agent)
  instances!: AgentInstance[];

  @OneToMany(() => AgentTool, (tool) => tool.agent)
  tools!: AgentTool[];

  @OneToMany(() => AgentParameter, (parameter) => parameter.agent)
  parameters!: AgentParameter[];

  @OneToMany(() => AgentConversation, (conversation) => conversation.agent)
  conversations!: AgentConversation[];

  @OneToOne(() => AgentAnalytics, (analytics) => analytics.agent, {
    cascade: true,
  })
  analytics!: AgentAnalytics;

  @OneToMany(() => Asset, (asset) => asset.agent)
  assets!: Asset[];

  @OneToMany(() => ExternalResource, (resource) => resource.agent)
  externalResources!: ExternalResource[];

  @OneToMany(() => DataSourceConnection, (connection) => connection.agent)
  dataSourceConnections!: DataSourceConnection[];
}
