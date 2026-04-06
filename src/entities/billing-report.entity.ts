import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { BillableItem } from "./enums/billable-item.enum";
import { Organization } from "./organization.entity";

@Entity("billing_reports")
export class BillingReport extends AuditableEntity {
  @Column({ name: "organization_id", type: "uuid" })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "organization_id" })
  organization!: Organization;

  @Column({
    name: "item",
    type: "enum",
    enum: BillableItem,
  })
  item!: BillableItem;

  @Column({ name: "billing_run_key", type: "varchar", length: 255 })
  billingRunKey!: string;

  @Column({ type: "text" })
  comment!: string;
}
