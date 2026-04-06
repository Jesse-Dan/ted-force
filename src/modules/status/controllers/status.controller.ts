import { Autowired, Controller, Get } from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { StatusService } from "../services/status.service";

@UseRequestContextPipeline()
@Controller("/status")
export class StatusController {
  @Autowired()
  private statusService!: StatusService;

  @Get()
  async getStatus() {
    return this.statusService.getStatus();
  }
}
