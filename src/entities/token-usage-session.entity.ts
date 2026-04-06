import { Column, Entity, Index } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";

export interface TokenStats {
  [key: string]: number | undefined;
}

@Entity("token_usage_sessions")
@Index(["runId", "sessionId"])
@Index(["modelName"])
export class TokenUsageSession extends AuditableEntity {
  @Column({ name: "run_id", type: "uuid" })
  runId!: string;

  @Column({ type: "varchar", length: 50, default: "tuul" })
  source!: string;

  @Column({ type: "varchar", length: 50, default: "live" })
  mode!: string;

  @Column({ name: "session_id", type: "uuid", nullable: true })
  sessionId?: string | null;

  @Column({ name: "model_name", type: "varchar", length: 100 })
  modelName!: string;

  @Column({ name: "input_tokens", type: "json" })
  inputTokens!: TokenStats;

  @Column({ name: "output_tokens", type: "json" })
  outputTokens!: TokenStats;

  @Column({ name: "available_tokens_before", type: "integer" })
  availableTokensBefore!: number;

  @Column({ name: "usable_tokens", type: "integer" })
  usableTokens!: number;

  @Column({ name: "available_tokens_after", type: "integer" })
  availableTokensAfter!: number;
}
