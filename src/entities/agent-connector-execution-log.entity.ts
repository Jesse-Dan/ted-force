import { Column, Entity, Index } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";

@Entity("agent_connector_execution_logs")
@Index("IDX_agent_connector_execution_logs_connector", ["connectorId", "createdAt"])
@Index("IDX_agent_connector_execution_logs_agent", ["agentId", "createdAt"])
export class AgentConnectorExecutionLog extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid" })
  @Index()
  agentId!: string;

  @Column({ name: "connector_id", type: "uuid" })
  @Index()
  connectorId!: string;

  @Column({ name: "session_id", type: "varchar", length: 255, nullable: true })
  sessionId?: string | null;

  @Column({ name: "operation_id", type: "varchar", length: 255 })
  operationId!: string;

  @Column({ type: "longtext" })
  intent!: string;

  @Column({ type: "longtext" })
  plan!: string;

  @Column({ type: "longtext" })
  execution!: string;

  @Column({ type: "longtext" })
  outcome!: string;

  @Column({ name: "response_status", type: "int", nullable: true })
  responseStatus?: number | null;

  @Column({ name: "success", type: "boolean", default: true })
  success!: boolean;

  @Column({ name: "metadata", type: "json", nullable: true })
  metadata?: Record<string, unknown> | null;
}
