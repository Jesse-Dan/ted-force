import { Validate, Validators } from "fragment-ts";

export class BootstrapPublicAgentDto {
  @Validate({ name: "sessionId" })
  @Validators.IsOptional()
  @Validators.IsString()
  sessionId?: string;
}
