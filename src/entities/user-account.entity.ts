import { Column, Entity, Index, OneToMany, PrimaryColumn } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { OrganizationMembership } from "./organization-membership.entity";

@Entity("user_accounts")
export class UserAccount extends AuditableEntity {
  @PrimaryColumn({ name: "idp_user_id", type: "varchar", length: 255 })
  declare id: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email!: string;

  @Column({ name: "first_name", type: "varchar", length: 100, nullable: true })
  firstName?: string | null;

  @Column({ name: "last_name", type: "varchar", length: 100, nullable: true })
  lastName?: string | null;

  @Column({ name: "display_name", type: "varchar", length: 255, nullable: true })
  displayName?: string | null;

  @Column({ name: "last_accessed_organization_id", type: "uuid", nullable: true })
  @Index()
  lastAccessedOrganizationId?: string | null;

  @Column({ name: "is_platform_admin", type: "boolean", default: false })
  isPlatformAdmin!: boolean;

  @OneToMany(() => OrganizationMembership, (membership) => membership.user)
  memberships!: OrganizationMembership[];
}
