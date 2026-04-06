import { RequiredString, Validate, Validators } from "fragment-ts";

export class GitCommitDto {
  @RequiredString(1, { name: "message", required: true })
  message!: string;

  @Validate({ name: "branchId" })
  @Validators.IsOptional()
  @Validators.IsString()
  branchId?: string;

  @Validate({ name: "branchName" })
  @Validators.IsOptional()
  @Validators.IsString()
  branchName?: string;

  @Validate({ name: "authorUserId" })
  @Validators.IsOptional()
  @Validators.IsString()
  authorUserId?: string;

  @Validate({ name: "authorName" })
  @Validators.IsOptional()
  @Validators.IsString()
  authorName?: string;
}
