import { Column, Entity, PrimaryColumn } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";

@Entity("domain_templates")
export class DomainTemplate extends AuditableEntity {
  @PrimaryColumn({ type: "varchar", length: 100 })
  declare id: string;

  @Column({ type: "varchar", length: 255 })
  icon!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "varchar", length: 100 })
  complexity!: string;

  @Column({ name: "use_cases", type: "simple-array", nullable: true })
  useCases?: string[];

  @Column({ name: "data_requirements", type: "text", nullable: true })
  dataRequirements?: string | null;

  @Column({ name: "agent_reference_id", type: "uuid", nullable: true })
  agentReferenceId?: string | null;
}
