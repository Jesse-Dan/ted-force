import { Validate, Validators } from "fragment-ts";

export class UpsertAgentAnalyticsDto {
  @Validate({ name: "apiCallsToday" })
  @Validators.IsOptional()
  @Validators.IsInt()
  apiCallsToday?: number;

  @Validate({ name: "errorRate" })
  @Validators.IsOptional()
  @Validators.IsNumber()
  errorRate?: number;

  @Validate({ name: "avgResponseTime" })
  @Validators.IsOptional()
  @Validators.IsNumber()
  avgResponseTime?: number;

  @Validate({ name: "activeUsers" })
  @Validators.IsOptional()
  @Validators.IsInt()
  activeUsers?: number;

  @Validate({ name: "weeklyUsage" })
  @Validators.IsOptional()
  @Validators.IsObject()
  weeklyUsage?: Record<string, number>;

  @Validate({ name: "responseTimeTrend" })
  @Validators.IsOptional()
  @Validators.IsObject()
  responseTimeTrend?: Record<string, number>;

  @Validate({ name: "functionUsage" })
  @Validators.IsOptional()
  @Validators.IsArray()
  functionUsage?: Array<{
    function: string;
    calls: number;
    avgTime: number;
    status: "good" | "warning" | "error";
  }>;
}
