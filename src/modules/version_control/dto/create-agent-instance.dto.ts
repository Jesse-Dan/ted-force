import { RequiredString, Validate, Validators } from "fragment-ts";
import { InstanceProjection } from "../../../entities/enums/instance-projection.enum";
import { InstanceReference } from "../../../entities/enums/instance-reference.enum";
import { InstanceStatus } from "../../../entities/enums/instance-status.enum";

export class CreateAgentInstanceDto {
  @RequiredString(1, { name: "version", required: true })
  version!: string;

  @RequiredString(1, { name: "apiUrl", required: true })
  apiUrl!: string;

  @Validate({ name: "guiUrl" })
  @Validators.IsOptional()
  @Validators.IsString()
  guiUrl?: string;

  @Validate({ name: "deployedAt" })
  @Validators.IsOptional()
  @Validators.IsDateString()
  deployedAt?: string;

  @Validate({ name: "status" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(InstanceStatus))
  status?: InstanceStatus;

  @Validate({ name: "projection" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(InstanceProjection))
  projection?: InstanceProjection;

  @Validate({ name: "reference" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(InstanceReference))
  reference?: InstanceReference;

  @Validate({ name: "commitHash" })
  @Validators.IsOptional()
  @Validators.IsString()
  commitHash?: string;
}
