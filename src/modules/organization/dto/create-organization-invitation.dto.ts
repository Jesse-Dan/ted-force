import { Email, Validate, Validators } from "fragment-ts";
import { OrganizationRole } from "../../../entities/enums/organization-role.enum";

export class CreateOrganizationInvitationDto {
  @Email({ name: "inviteeEmail", required: true })
  inviteeEmail!: string;

  @Validate({ name: "inviterUserId" })
  @Validators.IsOptional()
  @Validators.IsString()
  inviterUserId?: string;

  @Validate({ name: "role" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(OrganizationRole))
  role?: OrganizationRole;

  @Validate({ name: "expiresAt" })
  @Validators.IsOptional()
  @Validators.IsDateString()
  expiresAt?: string;
}
