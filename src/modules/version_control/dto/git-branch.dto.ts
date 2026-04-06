import { RequiredString, Validate, Validators } from "fragment-ts";

export class GitBranchDto {
  @RequiredString(1, { name: "name", required: true })
  name!: string;

  @Validate({ name: "fromBranchId" })
  @Validators.IsOptional()
  @Validators.IsString()
  fromBranchId?: string;

  @Validate({ name: "fromBranchName" })
  @Validators.IsOptional()
  @Validators.IsString()
  fromBranchName?: string;

  @Validate({ name: "pushAfterCreate" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  pushAfterCreate?: boolean;
}
