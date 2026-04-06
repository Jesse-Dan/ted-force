import { Validate, Validators } from "fragment-ts";
import { AgentStatus } from "../../../entities/enums/agent-status.enum";

export class UpdateAgentStatusDto {
  @Validate({ name: "status" })
  @Validators.IsIn(Object.values(AgentStatus))
  status!: AgentStatus;
}
