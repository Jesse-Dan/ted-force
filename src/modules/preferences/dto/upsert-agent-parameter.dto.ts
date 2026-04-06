import { Validate, Validators } from "fragment-ts";

export class UpsertAgentParameterDto {
  @Validate({ name: "persona" })
  @Validators.IsOptional()
  @Validators.IsArray()
  @Validators.IsString({ each: true })
  persona?: string[];

  @Validate({ name: "niche" })
  @Validators.IsOptional()
  @Validators.IsObject()
  niche?: Record<string, unknown>;

  @Validate({ name: "overview" })
  @Validators.IsOptional()
  @Validators.IsString()
  overview?: string;

  @Validate({ name: "documentation" })
  @Validators.IsOptional()
  @Validators.IsString()
  documentation?: string;

  @Validate({ name: "corePrompts" })
  @Validators.IsOptional()
  @Validators.IsArray()
  @Validators.IsString({ each: true })
  corePrompts?: string[];

  @Validate({ name: "responseFormat" })
  @Validators.IsOptional()
  @Validators.IsObject()
  responseFormat?: Record<string, unknown>;
}
