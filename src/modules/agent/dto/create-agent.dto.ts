import { RequiredString, Validate, Validators } from "fragment-ts";
import { AgentStatus } from "../../../entities/enums/agent-status.enum";

export class CreateAgentDto {
  @RequiredString(2, { name: "name", required: true })
  name!: string;

  @Validate({ name: "slug" })
  @Validators.IsOptional()
  @Validators.IsString()
  slug?: string;

  @Validate({ name: "description" })
  @Validators.IsOptional()
  @Validators.IsString()
  description?: string;

  @Validate({ name: "domainLabel" })
  @Validators.IsOptional()
  @Validators.IsString()
  domainLabel?: string;

  @Validate({ name: "organizationId" })
  @Validators.IsOptional()
  @Validators.IsString()
  organizationId?: string;

  @Validate({ name: "ownerUserId" })
  @Validators.IsOptional()
  @Validators.IsString()
  ownerUserId?: string;

  @Validate({ name: "status" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(AgentStatus))
  status?: AgentStatus;

  @Validate({ name: "visibility" })
  @Validators.IsOptional()
  @Validators.IsIn(["private", "public", "internal", "domain-available"])
  visibility?: "private" | "public" | "internal" | "domain-available";
}
