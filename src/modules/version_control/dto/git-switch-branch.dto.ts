import { Validate, Validators } from "fragment-ts";

export class GitSwitchBranchDto {
  @Validate({ name: "branchId" })
  @Validators.IsOptional()
  @Validators.IsString()
  branchId?: string;

  @Validate({ name: "branchName" })
  @Validators.IsOptional()
  @Validators.IsString()
  branchName?: string;
}
