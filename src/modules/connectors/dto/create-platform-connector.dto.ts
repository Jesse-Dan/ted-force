import { RequiredString, Validate, Validators } from "fragment-ts";

export class CreatePlatformConnectorDto {
  @RequiredString(2, { name: "key", required: true })
  key!: string;

  @RequiredString(2, { name: "name", required: true })
  name!: string;

  @Validate({ name: "description" })
  @Validators.IsOptional()
  @Validators.IsString()
  description?: string;

  @Validate({ name: "provider" })
  @Validators.IsOptional()
  @Validators.IsString()
  provider?: string;

  @Validate({ name: "category" })
  @Validators.IsOptional()
  @Validators.IsString()
  category?: string;

  @Validate({ name: "isActive" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isActive?: boolean;

  @Validate({ name: "uploadSource" })
  @Validators.IsOptional()
  @Validators.IsString()
  uploadSource?: string;

  @Validate({ name: "uploadId" })
  @Validators.IsOptional()
  @Validators.IsString()
  uploadId?: string;

  @Validate({ name: "logoUrl" })
  @Validators.IsOptional()
  @Validators.IsString()
  logoUrl?: string;

  @Validate({ name: "version" })
  @Validators.IsOptional()
  @Validators.IsString()
  version?: string;

  @Validate({ name: "definition" })
  @Validators.IsOptional()
  @Validators.IsObject()
  definition?: Record<string, unknown>;
}
