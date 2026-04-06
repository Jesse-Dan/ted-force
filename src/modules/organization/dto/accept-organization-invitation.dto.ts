import { Email, RequiredString, Validate, Validators } from "fragment-ts";

export class AcceptOrganizationInvitationDto {
  @RequiredString(1, { name: "userId", required: true })
  userId!: string;

  @Email({ name: "email", required: true })
  email!: string;

  @Validate({ name: "displayName" })
  @Validators.IsOptional()
  @Validators.IsString()
  displayName?: string;
}
