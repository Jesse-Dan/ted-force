import { Validate, Validators } from "fragment-ts";

export class UpdateSdkSecurityDto {
  @Validate({ name: "allowedIpAddresses" })
  @Validators.IsOptional()
  @Validators.IsArray()
  allowedIpAddresses?: string[];
}
