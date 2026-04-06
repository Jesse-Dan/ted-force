import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { OrganizationHealthStatus } from "./enums/organization-health-status.enum";
import { OrganizationStrikeStatus } from "./enums/organization-strike-status.enum";
import { Organization } from "./organization.entity";

@Entity("organization_health")
export class OrganizationHealth extends AuditableEntity {
  @Column({ name: "organization_id", type: "uuid" })
  organizationId!: string;

  @OneToOne(() => Organization, (organization) => organization.healthRecord, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "organization_id" })
  organization!: Organization;

  @Column({ name: "total_owed", type: "float", default: 0 })
  totalOwed!: number;

  @Column({ name: "total_paid", type: "float", default: 0 })
  totalPaid!: number;

  @Column({
    type: "enum",
    enum: OrganizationStrikeStatus,
    default: OrganizationStrikeStatus.NONE,
  })
  strike!: OrganizationStrikeStatus;

  @Column({
    type: "enum",
    enum: OrganizationHealthStatus,
    default: OrganizationHealthStatus.UP,
  })
  health!: OrganizationHealthStatus;

  @Column({ type: "text", nullable: true })
  message?: string | null;
}
