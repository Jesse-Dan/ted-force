import { Email, RequiredString, Validate, Validators } from "fragment-ts";

export class UpsertUserAccountDto {
  @RequiredString(1, { name: "id", required: true })
  id!: string;

  @Email({ name: "email", required: true })
  email!: string;

  @Validate({ name: "firstName" })
  @Validators.IsOptional()
  @Validators.IsString()
  firstName?: string;

  @Validate({ name: "lastName" })
  @Validators.IsOptional()
  @Validators.IsString()
  lastName?: string;

  @Validate({ name: "displayName" })
  @Validators.IsOptional()
  @Validators.IsString()
  displayName?: string;

  @Validate({ name: "lastAccessedOrganizationId" })
  @Validators.IsOptional()
  @Validators.IsString()
  lastAccessedOrganizationId?: string;
}
