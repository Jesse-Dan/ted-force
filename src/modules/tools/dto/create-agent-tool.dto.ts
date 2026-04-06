import { RequiredString, Validate, Validators } from "fragment-ts";

export class CreateAgentToolDto {
  @RequiredString(1, { name: "name", required: true })
  name!: string;

  @Validate({ name: "description" })
  @Validators.IsOptional()
  @Validators.IsString()
  description?: string;

  @Validate({ name: "schema" })
  @Validators.IsOptional()
  @Validators.IsObject()
  schema?: Record<string, unknown>;

  @Validate({ name: "code" })
  @Validators.IsOptional()
  @Validators.IsString()
  code?: string;

  @Validate({ name: "enabled" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  enabled?: boolean;

  @Validate({ name: "commitHash" })
  @Validators.IsOptional()
  @Validators.IsString()
  commitHash?: string;
}
