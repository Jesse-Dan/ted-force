import { Validate, Validators } from "fragment-ts";
import { ModelFamily } from "../../../entities/enums/model-family.enum";
import { ModelProvider } from "../../../entities/enums/model-provider.enum";

export class UpsertAgentConfigDto {
  @Validate({ name: "apiKey" })
  @Validators.IsOptional()
  @Validators.IsString()
  apiKey?: string | null;

  @Validate({ name: "systemApiKey" })
  @Validators.IsOptional()
  @Validators.IsString()
  systemApiKey?: string | null;

  @Validate({ name: "provider" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(ModelProvider))
  provider?: ModelProvider;

  @Validate({ name: "model" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(ModelFamily))
  model?: ModelFamily;

  @Validate({ name: "temperature" })
  @Validators.IsOptional()
  @Validators.IsNumber()
  temperature?: number;

  @Validate({ name: "maxTokens" })
  @Validators.IsOptional()
  @Validators.IsInt()
  maxTokens?: number;

  @Validate({ name: "topP" })
  @Validators.IsOptional()
  @Validators.IsNumber()
  topP?: number;

  @Validate({ name: "topK" })
  @Validators.IsOptional()
  @Validators.IsInt()
  topK?: number;

  @Validate({ name: "isSystemHealthy" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isSystemHealthy?: boolean;
}
