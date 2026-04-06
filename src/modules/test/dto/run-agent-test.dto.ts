import { RequiredString, Validate, Validators } from "fragment-ts";
import { RuntimeReasoningLevel } from "../../agent/dto/agent-runtime-request.dto";

export class RunAgentTestDto {
  @RequiredString(1, { name: "input", required: true })
  input!: string;

  @Validate({ name: "sessionId" })
  @Validators.IsOptional()
  @Validators.IsString()
  sessionId?: string;

  @Validate({ name: "conversationId" })
  @Validators.IsOptional()
  @Validators.IsString()
  conversationId?: string;

  @Validate({ name: "commitHash" })
  @Validators.IsOptional()
  @Validators.IsString()
  commitHash?: string;

  @Validate({ name: "instanceId" })
  @Validators.IsOptional()
  @Validators.IsString()
  instanceId?: string;

  @Validate({ name: "reasoning" })
  @Validators.IsOptional()
  @Validators.IsIn(["none", "low", "medium", "high"])
  reasoning?: RuntimeReasoningLevel;

  @Validate({ name: "webSearch" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  webSearch?: boolean;
}
