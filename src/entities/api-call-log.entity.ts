import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Agent } from "./agent.entity";
import { AuditableEntity } from "./base/auditable.entity";
import { ApiCallStatus } from "./enums/api-call-status.enum";
import { HttpMethod } from "./enums/http-method.enum";

export interface ToolFunctionCall {
  name: string;
  arguments?: Record<string, unknown>;
}

@Entity("api_call_logs")
export class ApiCallLog extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid", nullable: true })
  @Index()
  agentId?: string | null;

  @ManyToOne(() => Agent, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "agent_id" })
  agent?: Agent | null;

  @Column({ type: "varchar", length: 2048 })
  endpoint!: string;

  @Column({ type: "enum", enum: HttpMethod })
  method!: HttpMethod;

  @Column({ name: "request_body", type: "json", nullable: true })
  requestBody?: Record<string, unknown> | null;

  @Column({ name: "tool_call", type: "json", nullable: true })
  toolCall?: ToolFunctionCall | null;

  @Column({ name: "response_body", type: "json", nullable: true })
  responseBody?: Record<string, unknown> | null;

  @Column({
    type: "enum",
    enum: ApiCallStatus,
    default: ApiCallStatus.SUCCESS,
  })
  status!: ApiCallStatus;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage?: string | null;

  @Column({ name: "ip_address", type: "varchar", length: 255, nullable: true })
  ipAddress?: string | null;

  @Column({ name: "user_agent", type: "varchar", length: 1024, nullable: true })
  userAgent?: string | null;

  @Column({ name: "duration_in_milliseconds", type: "int", nullable: true })
  durationInMilliseconds?: number | null;
}
