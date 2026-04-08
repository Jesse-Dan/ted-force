import { RequiredString, Validate, Validators } from "fragment-ts";

export class ExecuteConnectorOperationDto {
  @Validate({ name: "agentId" })
  @Validators.IsOptional()
  @Validators.IsString()
  agentId?: string;

  @RequiredString(1, { name: "operation_id", required: true })
  operation_id!: string;

  @Validate({ name: "parameters" })
  @Validators.IsOptional()
  @Validators.IsObject()
  parameters?: Record<string, unknown>;

  @Validate({ name: "sessionId" })
  @Validators.IsOptional()
  @Validators.IsString()
  sessionId?: string;
}
