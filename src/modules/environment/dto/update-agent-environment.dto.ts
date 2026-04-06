import { Validate, Validators } from "fragment-ts";

export class UpdateAgentEnvironmentDto {
  @Validate({ name: "key" })
  @Validators.IsOptional()
  @Validators.IsString()
  key?: string;

  @Validate({ name: "value" })
  @Validators.IsOptional()
  @Validators.IsString()
  value?: string;

  @Validate({ name: "isSecret" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isSecret?: boolean;

  @Validate({ name: "description" })
  @Validators.IsOptional()
  @Validators.IsString()
  description?: string | null;
}
