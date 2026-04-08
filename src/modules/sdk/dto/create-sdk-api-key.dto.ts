import { Validate, Validators } from "fragment-ts";

export class CreateSdkApiKeyDto {
  @Validate({ name: "name" })
  @Validators.IsString()
  name!: string;

  @Validate({ name: "scopes" })
  @Validators.IsOptional()
  @Validators.IsArray()
  scopes?: string[];
}
