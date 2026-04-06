import { Email, RequiredString, Validate, Validators } from "fragment-ts";

export class InitializeOnboardingDto {
  @RequiredString(1, { name: "userId", required: true })
  userId!: string;

  @Email({ name: "email", required: true })
  email!: string;

  @Validate({ name: "displayName" })
  @Validators.IsOptional()
  @Validators.IsString()
  displayName?: string;

  @Validate({ name: "organizationName" })
  @Validators.IsOptional()
  @Validators.IsString()
  organizationName?: string;

  @Validate({ name: "organizationSlug" })
  @Validators.IsOptional()
  @Validators.IsString()
  organizationSlug?: string;

  @Validate({ name: "teamSize" })
  @Validators.IsOptional()
  @Validators.IsString()
  teamSize?: string;
}
