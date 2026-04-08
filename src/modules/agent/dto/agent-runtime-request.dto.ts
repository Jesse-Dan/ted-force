import { Validate, Validators } from "fragment-ts";

export type RuntimeReasoningLevel = "none" | "low" | "medium" | "high";

export class AgentRuntimeLocalToolDto {
  @Validate({ name: "name" })
  @Validators.IsOptional()
  @Validators.IsString()
  name?: string;

  @Validate({ name: "description" })
  @Validators.IsOptional()
  @Validators.IsString()
  description?: string;

  @Validate({ name: "inputSchema" })
  @Validators.IsOptional()
  inputSchema?: Record<string, unknown>;
}

export class AgentRuntimeRequestDto {
  @Validate({ name: "input" })
  @Validators.IsOptional()
  @Validators.IsString()
  input?: string;

  @Validate({ name: "sessionId" })
  @Validators.IsOptional()
  @Validators.IsString()
  sessionId?: string;

  @Validate({ name: "conversationId" })
  @Validators.IsOptional()
  @Validators.IsString()
  conversationId?: string;

  @Validate({ name: "system" })
  @Validators.IsOptional()
  @Validators.IsString()
  system?: string;

  @Validate({ name: "mock" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  mock?: boolean;

  @Validate({ name: "stream" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  stream?: boolean;

  @Validate({ name: "webSearch" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  webSearch?: boolean;

  @Validate({ name: "reasoning" })
  @Validators.IsOptional()
  @Validators.IsIn(["none", "low", "medium", "high"])
  reasoning?: RuntimeReasoningLevel;

  @Validate({ name: "fileIds" })
  @Validators.IsOptional()
  @Validators.IsArray()
  fileIds?: string[];

  @Validate({ name: "commitHash" })
  @Validators.IsOptional()
  @Validators.IsString()
  commitHash?: string;

  @Validate({ name: "instanceId" })
  @Validators.IsOptional()
  @Validators.IsString()
  instanceId?: string;

  @Validate({ name: "localTools" })
  @Validators.IsOptional()
  @Validators.IsArray()
  localTools?: AgentRuntimeLocalToolDto[];

  @Validate({ name: "continuationMessages" })
  @Validators.IsOptional()
  @Validators.IsArray()
  continuationMessages?: Record<string, unknown>[];
}
