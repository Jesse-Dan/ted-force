import { Autowired, Controller, Get } from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { PublicService } from "../services/public.service";

@UseRequestContextPipeline()
@Controller("/public/domain-templates")
export class PublicDomainTemplatesController {
  @Autowired()
  private publicService!: PublicService;

  @Get()
  async listTemplates() {
    return this.publicService.getDomainTemplates();
  }
}
