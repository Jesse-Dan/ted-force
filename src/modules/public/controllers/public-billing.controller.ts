import { Autowired, Controller, Get } from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { PublicService } from "../services/public.service";

@UseRequestContextPipeline()
@Controller("/public/billing")
export class PublicBillingController {
  @Autowired()
  private publicService!: PublicService;

  @Get("/catalog")
  async getCatalog() {
    return this.publicService.getBillingCatalog();
  }
}
