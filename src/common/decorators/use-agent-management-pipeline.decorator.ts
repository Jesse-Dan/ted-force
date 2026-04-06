import { FragmentGuard } from "fragment-ts";
import { AgentAccessGuard } from "../guards/agent-access.guard";
import { UseManagedRequestPipeline } from "./use-managed-request-pipeline.decorator";

export function UseAgentManagementPipeline(): ClassDecorator {
  return (target) => {
    UseManagedRequestPipeline()(target);
    FragmentGuard(AgentAccessGuard)(target);
  };
}
