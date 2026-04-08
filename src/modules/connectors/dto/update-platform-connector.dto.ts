import { Validate, Validators } from "fragment-ts";

export class UpdatePlatformConnectorDto {
  @Validate({ name: "key" })
  @Validators.IsOptional()
  @Validators.IsString()
  key?: string;

  @Validate({ name: "name" })
  @Validators.IsOptional()
  @Validators.IsString()
  name?: string;

  @Validate({ name: "provider" })
  @Validators.IsOptional()
  @Validators.IsString()
  provider?: string;

  @Validate({ name: "description" })
  @Validators.IsOptional()
  @Validators.IsString()
  description?: string | null;

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
  uploadSource?: string | null;

  @Validate({ name: "uploadId" })
  @Validators.IsOptional()
  @Validators.IsString()
  uploadId?: string | null;

  @Validate({ name: "logoUrl" })
  @Validators.IsOptional()
  @Validators.IsString()
  logoUrl?: string | null;

  @Validate({ name: "version" })
  @Validators.IsOptional()
  @Validators.IsString()
  version?: string;

  @Validate({ name: "definition" })
  @Validators.IsOptional()
  @Validators.IsObject()
  definition?: Record<string, unknown> | null;
}
