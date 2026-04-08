import { Validate, Validators } from "fragment-ts";

export class UpdateSdkRateLimitsDto {
  @Validate({ name: "requestsPerMinute" })
  @Validators.IsOptional()
  @Validators.IsInt()
  requestsPerMinute?: number;

  @Validate({ name: "burstCapacity" })
  @Validators.IsOptional()
  @Validators.IsInt()
  burstCapacity?: number;

  @Validate({ name: "adaptiveThrottling" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  adaptiveThrottling?: boolean;

  @Validate({ name: "blockAnonymousTraffic" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  blockAnonymousTraffic?: boolean;
}
