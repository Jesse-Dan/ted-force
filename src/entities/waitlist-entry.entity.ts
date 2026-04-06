import { Column, Entity, Index } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { WaitlistStatus } from "./enums/waitlist-status.enum";

export interface WaitlistRequestContext {
  ip?: string;
  userAgent?: string;
  referrer?: string;
  origin?: string;
  pathname?: string;
  country?: string;
  city?: string;
  headers?: Record<string, string | string[] | undefined>;
}

@Entity("waitlist_entries")
export class WaitlistEntry extends AuditableEntity {
  @Column({ type: "varchar", length: 225, unique: true })
  email!: string;

  @Column({ name: "full_name", type: "varchar", length: 255, nullable: true })
  fullName?: string | null;

  @Column({ name: "company_name", type: "varchar", length: 255, nullable: true })
  companyName?: string | null;

  @Column({ name: "job_title", type: "varchar", length: 255, nullable: true })
  jobTitle?: string | null;

  @Column({ name: "use_case", type: "text", nullable: true })
  useCase?: string | null;

  @Column({ name: "team_size", type: "varchar", length: 64, nullable: true })
  teamSize?: string | null;

  @Column({ name: "notes", type: "text", nullable: true })
  notes?: string | null;

  @Column({
    type: "enum",
    enum: WaitlistStatus,
    default: WaitlistStatus.PENDING,
  })
  status!: WaitlistStatus;

  @Column({ name: "request_context", type: "json", nullable: true })
  requestContext?: WaitlistRequestContext | null;
}
