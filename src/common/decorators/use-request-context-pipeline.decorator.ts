import {
  FragmentInterceptor,
  FragmentMiddleware,
} from "fragment-ts";
import { RequestTracingInterceptor } from "../interceptors/request-tracing.interceptor";
import { TimingInterceptor } from "../interceptors/timing.interceptor";
import { PermissionHubMiddleware } from "../middlewares/permission-hub.middleware";
import { RequestContextMiddleware } from "../middlewares/request-context.middleware";

export function UseRequestContextPipeline(): ClassDecorator {
  return (target) => {
    FragmentMiddleware(RequestContextMiddleware, { order: -100 })(target);
    FragmentMiddleware(PermissionHubMiddleware, { order: -90 })(target);
    FragmentInterceptor(RequestTracingInterceptor)(target);
    FragmentInterceptor(TimingInterceptor)(target);
  };
}
