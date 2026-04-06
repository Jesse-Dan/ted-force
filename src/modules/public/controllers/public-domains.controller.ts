import { Autowired, Controller, Get } from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { PublicService } from "../services/public.service";

@UseRequestContextPipeline()
@Controller("/public/domains")
export class PublicDomainsController {
  @Autowired()
  private publicService!: PublicService;

  @Get()
  async listDomains() {
    return this.publicService.getDomains();
  }
}
