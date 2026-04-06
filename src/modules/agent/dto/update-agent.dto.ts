import { Validate, Validators } from "fragment-ts";
import { AgentStatus } from "../../../entities/enums/agent-status.enum";

export class UpdateAgentDto {
  @Validate({ name: "name" })
  @Validators.IsOptional()
  @Validators.IsString()
  name?: string;

  @Validate({ name: "slug" })
  @Validators.IsOptional()
  @Validators.IsString()
  slug?: string;

  @Validate({ name: "description" })
  @Validators.IsOptional()
  @Validators.IsString()
  description?: string | null;

  @Validate({ name: "domainLabel" })
  @Validators.IsOptional()
  @Validators.IsString()
  domainLabel?: string | null;

  @Validate({ name: "organizationId" })
  @Validators.IsOptional()
  @Validators.IsString()
  organizationId?: string | null;

  @Validate({ name: "ownerUserId" })
  @Validators.IsOptional()
  @Validators.IsString()
  ownerUserId?: string | null;

  @Validate({ name: "status" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(AgentStatus))
  status?: AgentStatus;
}
