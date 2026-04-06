import { Autowired, Body, Controller, Post } from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { InitializeOnboardingDto } from "../dto/initialize-onboarding.dto";
import { OnboardingService } from "../services/onboarding.service";

@UseRequestContextPipeline()
@Controller("/onboarding")
export class OnboardingController {
  @Autowired()
  private onboardingService!: OnboardingService;

  @Post("/initialize")
  async initialize(@Body() body: InitializeOnboardingDto) {
    return this.onboardingService.initialize(body);
  }
}
