import { RequiredString, Validate, Validators } from "fragment-ts";

export class ImportOpenApiConnectorDto {
  @RequiredString(1, { name: "agentId", required: true })
  agentId!: string;

  @RequiredString(2, { name: "name", required: true })
  name!: string;

  @Validate({ name: "description" })
  @Validators.IsOptional()
  @Validators.IsString()
  description?: string;

  @Validate({ name: "specText" })
  @Validators.IsOptional()
  @Validators.IsString()
  specText?: string;

  @Validate({ name: "specObject" })
  @Validators.IsOptional()
  @Validators.IsObject()
  specObject?: Record<string, unknown>;

  @Validate({ name: "isLive" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isLive?: boolean;

  @Validate({ name: "isPublic" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isPublic?: boolean;
}
