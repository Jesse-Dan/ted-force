import { FragmentGuard } from "fragment-ts";
import { AuthGuard } from "../guards/auth.guard";
import { UseRequestContextPipeline } from "./use-request-context-pipeline.decorator";

export function UseManagedRequestPipeline(): ClassDecorator {
  return (target) => {
    UseRequestContextPipeline()(target);
    FragmentGuard(AuthGuard)(target);
  };
}
