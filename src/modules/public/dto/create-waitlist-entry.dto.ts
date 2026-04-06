import { Email, RequiredString, Validate, Validators } from "fragment-ts";

export class CreateWaitlistEntryDto {
  @Email({ name: "email", required: true })
  email!: string;

  @Validate({ name: "fullName" })
  @Validators.IsOptional()
  @Validators.IsString()
  fullName?: string;

  @Validate({ name: "companyName" })
  @Validators.IsOptional()
  @Validators.IsString()
  companyName?: string;

  @Validate({ name: "jobTitle" })
  @Validators.IsOptional()
  @Validators.IsString()
  jobTitle?: string;

  @Validate({ name: "useCase" })
  @Validators.IsOptional()
  @Validators.IsString()
  useCase?: string;

  @Validate({ name: "teamSize" })
  @Validators.IsOptional()
  @Validators.IsString()
  teamSize?: string;

  @Validate({ name: "notes" })
  @Validators.IsOptional()
  @Validators.IsString()
  notes?: string;

  @Validate({ name: "source" })
  @Validators.IsOptional()
  @Validators.IsString()
  source?: string;

  @Validate({ name: "interestLabel" })
  @Validators.IsOptional()
  @Validators.IsString()
  interestLabel?: string;
}
