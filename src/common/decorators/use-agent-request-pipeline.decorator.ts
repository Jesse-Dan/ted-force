import { FragmentGuard } from "fragment-ts";
import { AgentAccessGuard } from "../guards/agent-access.guard";
import { UseRequestContextPipeline } from "./use-request-context-pipeline.decorator";

export function UseAgentRequestPipeline(): ClassDecorator {
  return (target) => {
    UseRequestContextPipeline()(target);
    FragmentGuard(AgentAccessGuard)(target);
  };
}
