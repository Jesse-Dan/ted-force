import { RequiredString, Validate, Validators } from "fragment-ts";

export class ActivatePlatformConnectorDto {
  @RequiredString(1, { name: "agentId", required: true })
  agentId!: string;

  @Validate({ name: "name" })
  @Validators.IsOptional()
  @Validators.IsString()
  name?: string;

  @Validate({ name: "description" })
  @Validators.IsOptional()
  @Validators.IsString()
  description?: string;

  @Validate({ name: "isLive" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isLive?: boolean;

  @Validate({ name: "isPublic" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isPublic?: boolean;
}
