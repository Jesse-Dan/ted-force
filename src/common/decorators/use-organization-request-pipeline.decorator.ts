import { FragmentGuard } from "fragment-ts";
import { OrganizationGuard } from "../guards/organization.guard";
import { UseManagedRequestPipeline } from "./use-managed-request-pipeline.decorator";

export function UseOrganizationRequestPipeline(): ClassDecorator {
  return (target) => {
    UseManagedRequestPipeline()(target);
    FragmentGuard(OrganizationGuard)(target);
  };
}
