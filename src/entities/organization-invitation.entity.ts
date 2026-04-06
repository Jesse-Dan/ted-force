import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { InvitationStatus } from "./enums/invitation-status.enum";
import { OrganizationRole } from "./enums/organization-role.enum";
import { Organization } from "./organization.entity";
import { UserAccount } from "./user-account.entity";

@Entity("organization_invitations")
export class OrganizationInvitation extends AuditableEntity {
  @Column({ name: "organization_id", type: "uuid" })
  organizationId!: string;

  @Column({ name: "invitee_email", type: "varchar", length: 255 })
  inviteeEmail!: string;

  @Column({ name: "inviter_user_id", type: "varchar", length: 255, nullable: true })
  inviterUserId?: string | null;

  @Column({
    type: "enum",
    enum: OrganizationRole,
    default: OrganizationRole.MEMBER,
  })
  role!: OrganizationRole;

  @Column({
    type: "enum",
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status!: InvitationStatus;

  @Column({ name: "expires_at", type: "timestamp", nullable: true })
  expiresAt?: Date | null;

  @ManyToOne(() => Organization, (organization) => organization.invitations, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "organization_id" })
  organization!: Organization;

  @ManyToOne(() => UserAccount, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "inviter_user_id", referencedColumnName: "id" })
  inviter?: UserAccount | null;
}
