import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { Organization } from "./organization.entity";

@Entity("billing_ledger_entries")
export class BillingLedgerEntry extends AuditableEntity {
  @Column({ name: "organization_id", type: "uuid" })
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "organization_id" })
  organization!: Organization;

  @Column({ name: "billing_run_key", type: "varchar", length: 255 })
  billingRunKey!: string;

  @Column({ name: "report_bill_status", type: "json", nullable: true })
  reportBillStatus?: Record<string, unknown> | null;

  @Column({ name: "tried_at", type: "timestamp", nullable: true })
  triedAt?: Date | null;
}
