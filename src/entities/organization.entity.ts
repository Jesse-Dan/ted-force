import { Column, Entity, OneToMany, OneToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { Agent } from "./agent.entity";
import { BillingLedgerEntry } from "./billing-ledger-entry.entity";
import { BillingReport } from "./billing-report.entity";
import { OrganizationHealth } from "./organization-health.entity";
import { OrganizationInvitation } from "./organization-invitation.entity";
import { OrganizationMembership } from "./organization-membership.entity";
import { OrganizationPlan } from "./enums/organization-plan.enum";
import { OrganizationProfile } from "./organization-profile.entity";
import { OrganizationRepositoryConnection } from "./organization-repository-connection.entity";

export interface OrganizationGitRemoteConfig {
  enabled?: boolean;
  provider?: "github" | "gitlab" | "gitea" | "generic" | "bitbucket";
  repositoryUrl?: string | null;
  githubLogin?: string | null;
  githubAvatarUrl?: string | null;
  owner?: string | null;
  defaultBranch?: string | null;
  accessToken?: string | null;
  username?: string | null;
  authType?: "token" | "github_app" | "none";
  appInstallationId?: number | null;
  appClientId?: string | null;
  connectedAt?: string | null;
}

export interface OrganizationMetadata {
  buildType?: "none" | "digitwhale" | null;
  gitRemote?: OrganizationGitRemoteConfig | null;
}

@Entity("organizations")
export class Organization extends AuditableEntity {
  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ name: "slug", type: "varchar", length: 255, unique: true, nullable: true })
  slug?: string | null;

  @Column({ name: "size_label", type: "varchar", length: 64, default: "1" })
  sizeLabel!: string;

  @Column({ name: "is_enabled", type: "boolean", default: false })
  isEnabled!: boolean;

  @Column({
    name: "enabled_message",
    type: "varchar",
    length: 255,
    nullable: true,
    default: "Credit Account requires starting balance of $10 (1000CRD)",
  })
  enabledMessage?: string | null;

  @Column({
    type: "enum",
    enum: OrganizationPlan,
    default: OrganizationPlan.FREE,
  })
  plan!: OrganizationPlan;

  @Column({ type: "json", nullable: true })
  metadata?: OrganizationMetadata | null;

  @OneToMany(() => OrganizationMembership, (membership) => membership.organization)
  memberships!: OrganizationMembership[];

  @OneToMany(() => Agent, (agent) => agent.organization)
  agents!: Agent[];

  @OneToMany(() => OrganizationInvitation, (invitation) => invitation.organization)
  invitations!: OrganizationInvitation[];

  @OneToOne(() => OrganizationHealth, (healthRecord) => healthRecord.organization)
  healthRecord!: OrganizationHealth;

  @OneToOne(() => OrganizationProfile, (profile) => profile.organization)
  profile!: OrganizationProfile;

  @OneToOne(
    () => OrganizationRepositoryConnection,
    (repositoryConnection) => repositoryConnection.organization,
  )
  repositoryConnection?: OrganizationRepositoryConnection | null;

  @OneToMany(() => BillingLedgerEntry, (billingEntry) => billingEntry.organization)
  billingEntries!: BillingLedgerEntry[];

  @OneToMany(() => BillingReport, (billingReport) => billingReport.organization)
  billingReports!: BillingReport[];
}
