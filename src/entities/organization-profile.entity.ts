import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { Organization } from "./organization.entity";

@Entity("organization_profiles")
export class OrganizationProfile extends AuditableEntity {
  @Column({ name: "organization_id", type: "uuid" })
  organizationId!: string;

  @OneToOne(() => Organization, (organization) => organization.profile, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "organization_id" })
  organization!: Organization;

  @Column({ name: "team_size", type: "varchar", length: 64, nullable: true })
  teamSize?: string | null;

  @Column({ name: "use_case", type: "text", nullable: true })
  useCase?: string | null;

  @Column({ name: "how_found", type: "varchar", length: 255, nullable: true })
  howFound?: string | null;

  @Column({ name: "previous_tool", type: "varchar", length: 255, nullable: true })
  previousTool?: string | null;
}
