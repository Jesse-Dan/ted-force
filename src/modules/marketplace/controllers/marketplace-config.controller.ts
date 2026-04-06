import { Autowired, Controller, Get } from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { MarketplaceConfigService } from "../services/marketplace-config.service";

@UseRequestContextPipeline()
@Controller("/marketplace")
export class MarketplaceConfigController {
  @Autowired()
  private marketplaceConfigService!: MarketplaceConfigService;

  @Get()
  getManifest() {
    return this.marketplaceConfigService.getManifest();
  }
}
