import { RequiredString, Validate, Validators } from "fragment-ts";
import { OrganizationPlan } from "../../../entities/enums/organization-plan.enum";

export class CreateOrganizationDto {
  @RequiredString(2, { name: "name", required: true })
  name!: string;

  @Validate({ name: "slug" })
  @Validators.IsOptional()
  @Validators.IsString()
  slug?: string;

  @Validate({ name: "ownerUserId" })
  @Validators.IsOptional()
  @Validators.IsString()
  ownerUserId?: string;

  @Validate({ name: "ownerEmail" })
  @Validators.IsOptional()
  @Validators.IsEmail()
  ownerEmail?: string;

  @Validate({ name: "ownerFirstName" })
  @Validators.IsOptional()
  @Validators.IsString()
  ownerFirstName?: string;

  @Validate({ name: "ownerLastName" })
  @Validators.IsOptional()
  @Validators.IsString()
  ownerLastName?: string;

  @Validate({ name: "ownerDisplayName" })
  @Validators.IsOptional()
  @Validators.IsString()
  ownerDisplayName?: string;

  @Validate({ name: "sizeLabel" })
  @Validators.IsOptional()
  @Validators.IsString()
  sizeLabel?: string;

  @Validate({ name: "size" })
  @Validators.IsOptional()
  size?: string | number;

  @Validate({ name: "enabledMessage" })
  @Validators.IsOptional()
  @Validators.IsString()
  enabledMessage?: string;

  @Validate({ name: "isEnabled" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isEnabled?: boolean;

  @Validate({ name: "enabled" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  enabled?: boolean;

  @Validate({ name: "pin" })
  @Validators.IsOptional()
  @Validators.IsString()
  pin?: string;

  @Validate({ name: "plan" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(OrganizationPlan))
  plan?: OrganizationPlan;
}
