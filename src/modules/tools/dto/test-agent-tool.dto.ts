import { Validate, Validators } from "fragment-ts";

export class TestAgentToolDto {
  @Validate({ name: "agentToolId" })
  @Validators.IsOptional()
  @Validators.IsString()
  agentToolId?: string;

  @Validate({ name: "tuulId" })
  @Validators.IsOptional()
  @Validators.IsString()
  tuulId?: string;

  @Validate({ name: "agentId" })
  @Validators.IsOptional()
  @Validators.IsString()
  agentId?: string;

  @Validate({ name: "sessionId" })
  @Validators.IsOptional()
  @Validators.IsString()
  sessionId?: string;

  @Validate({ name: "args" })
  @Validators.IsOptional()
  @Validators.IsObject()
  args?: Record<string, unknown>;
}
