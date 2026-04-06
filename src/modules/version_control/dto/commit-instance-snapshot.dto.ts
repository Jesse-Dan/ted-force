import { RequiredString, Validate, Validators } from "fragment-ts";

export class CommitInstanceSnapshotDto {
  @RequiredString(1, { name: "message", required: true })
  message!: string;

  @Validate({ name: "authorUserId" })
  @Validators.IsOptional()
  @Validators.IsString()
  authorUserId?: string;

  @Validate({ name: "authorName" })
  @Validators.IsOptional()
  @Validators.IsString()
  authorName?: string;
}
