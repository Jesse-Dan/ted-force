import { Autowired, Controller, Get } from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { PublicService } from "../services/public.service";

@UseRequestContextPipeline()
@Controller("/public/status")
export class PublicStatusController {
  @Autowired()
  private publicService!: PublicService;

  @Get()
  async status() {
    return this.publicService.getStatus();
  }
}
