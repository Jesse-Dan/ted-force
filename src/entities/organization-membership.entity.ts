import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { OrganizationRole } from "./enums/organization-role.enum";
import { Organization } from "./organization.entity";
import { UserAccount } from "./user-account.entity";

@Entity("organization_memberships")
@Unique("uq_membership_user_org", ["userId", "organizationId"])
export class OrganizationMembership extends AuditableEntity {
  @Column({ name: "user_id", type: "varchar", length: 255 })
  @Index()
  userId!: string;

  @Column({ name: "organization_id", type: "uuid" })
  @Index()
  organizationId!: string;

  @Column({
    type: "enum",
    enum: OrganizationRole,
    default: OrganizationRole.MEMBER,
  })
  role!: OrganizationRole;

  @ManyToOne(() => UserAccount, (user) => user.memberships, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user!: UserAccount;

  @ManyToOne(() => Organization, (organization) => organization.memberships, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "organization_id" })
  organization!: Organization;
}
