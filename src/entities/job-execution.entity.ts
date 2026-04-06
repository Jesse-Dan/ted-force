import { Column, Entity, Index } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";

export type JobExecutionStatus = "running" | "completed" | "failed";

@Entity("job_executions")
@Index(["jobName", "createdAt"])
export class JobExecution extends AuditableEntity {
  @Column({ name: "job_name", type: "varchar", length: 255 })
  jobName!: string;

  @Column({ type: "varchar", length: 32 })
  status!: JobExecutionStatus;

  @Column({ name: "started_at", type: "timestamp", nullable: true })
  startedAt?: Date | null;

  @Column({ name: "completed_at", type: "timestamp", nullable: true })
  completedAt?: Date | null;

  @Column({ name: "failed_at", type: "timestamp", nullable: true })
  failedAt?: Date | null;

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError?: string | null;

  @Column({ type: "json", nullable: true })
  meta?: Record<string, unknown> | null;
}
