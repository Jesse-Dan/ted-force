import { Controller, Get } from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";

@UseRequestContextPipeline()
@Controller("/")
export class AppController {
  @Get()
  index() {
    return {
      service: "digitwhale_tuul_service_v2",
      framework: "fragment-ts",
      status: "bootstrapped",
    };
  }
}
