import { RequiredString, Validate, Validators } from "fragment-ts";

export class CreateAgentEnvironmentDto {
  @RequiredString(1, { name: "key", required: true })
  key!: string;

  @RequiredString(1, { name: "value", required: true })
  value!: string;

  @Validate({ name: "isSecret" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isSecret?: boolean;

  @Validate({ name: "description" })
  @Validators.IsOptional()
  @Validators.IsString()
  description?: string;
}
