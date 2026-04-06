import { Validate, Validators } from "fragment-ts";

export class GitConflictMergeDto {
  @Validate({ name: "message" })
  @Validators.IsOptional()
  @Validators.IsString()
  message?: string;

  @Validate({ name: "resolutions" })
  @Validators.IsOptional()
  @Validators.IsObject()
  resolutions?: Record<string, "local" | "remote">;
}
