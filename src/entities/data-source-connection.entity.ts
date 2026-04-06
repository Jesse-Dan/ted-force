import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Agent } from "./agent.entity";
import { AuditableEntity } from "./base/auditable.entity";
import { DataSourceType } from "./enums/data-source-type.enum";

@Entity("data_source_connections")
export class DataSourceConnection extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid" })
  @Index()
  agentId!: string;

  @ManyToOne(() => Agent, (agent) => agent.dataSourceConnections, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "enum", enum: DataSourceType })
  type!: DataSourceType;

  @Column({ type: "json", nullable: true })
  config?: Record<string, unknown> | null;
}
