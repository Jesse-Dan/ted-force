import { Validate, Validators } from "fragment-ts";

export class UpsertCapabilityProfileDto {
  @Validate({ name: "capabilityFlags" })
  @Validators.IsOptional()
  @Validators.IsObject()
  capabilityFlags?: Record<string, boolean>;

  @Validate({ name: "restrictions" })
  @Validators.IsOptional()
  @Validators.IsArray()
  @Validators.IsString({ each: true })
  restrictions?: string[];

  @Validate({ name: "toolPolicies" })
  @Validators.IsOptional()
  @Validators.IsArray()
  toolPolicies?: Array<Record<string, unknown>>;
}
