import { Autowired, Controller, Get } from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { SdkConfigService } from "../services/sdk-config.service";

@UseRequestContextPipeline()
@Controller("/sdk")
export class SdkConfigController {
  @Autowired()
  private sdkConfigService!: SdkConfigService;

  @Get()
  getManifest() {
    return this.sdkConfigService.getManifest();
  }
}
