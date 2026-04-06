import { RequiredString, Validate, Validators } from "fragment-ts";

export class CreateVersionEntryDto {
  @RequiredString(1, { name: "version", required: true })
  version!: string;

  @Validate({ name: "releasedAt" })
  @Validators.IsOptional()
  @Validators.IsDateString()
  releasedAt?: string;

  @Validate({ name: "message" })
  @Validators.IsOptional()
  @Validators.IsString()
  message?: string;

  @Validate({ name: "commitHash" })
  @Validators.IsOptional()
  @Validators.IsString()
  commitHash?: string;

  @Validate({ name: "author" })
  @Validators.IsOptional()
  @Validators.IsObject()
  author?: {
    userName?: string;
    userId?: string;
  };
}
