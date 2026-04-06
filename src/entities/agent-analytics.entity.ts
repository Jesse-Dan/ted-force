import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { Agent } from "./agent.entity";
import { AuditableEntity } from "./base/auditable.entity";

export interface FunctionUsageMetric {
  function: string;
  calls: number;
  avgTime: number;
  status: "good" | "warning" | "error";
}

@Entity("agent_analytics")
export class AgentAnalytics extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid" })
  agentId!: string;

  @OneToOne(() => Agent, (agent) => agent.analytics, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent;

  @Column({ name: "api_calls_today", type: "int", default: 0 })
  apiCallsToday!: number;

  @Column({ name: "error_rate", type: "float", default: 0 })
  errorRate!: number;

  @Column({ name: "avg_response_time", type: "float", default: 0 })
  avgResponseTime!: number;

  @Column({ name: "active_users", type: "int", default: 0 })
  activeUsers!: number;

  @Column({ name: "weekly_usage", type: "json", nullable: true })
  weeklyUsage?: Record<string, number> | null;

  @Column({ name: "response_time_trend", type: "json", nullable: true })
  responseTimeTrend?: Record<string, number> | null;

  @Column({ name: "function_usage", type: "json", nullable: true })
  functionUsage?: FunctionUsageMetric[] | null;
}
