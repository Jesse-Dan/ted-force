import { Autowired, Controller, FragmentMiddleware, Get, Param, Query } from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { SdkRateLimitMiddleware } from "../../../common/middlewares/sdk-rate-limit.middleware";
import { SdkConfigService } from "../services/sdk-config.service";
import { SdkManagementService } from "../services/sdk-management.service";

@UseRequestContextPipeline()
@FragmentMiddleware(SdkRateLimitMiddleware, { order: -80 })
@Controller("/sdk")
export class SdkConfigController {
  @Autowired()
  private sdkConfigService!: SdkConfigService;

  @Autowired()
  private sdkManagementService!: SdkManagementService;

  @Get()
  getManifest() {
    return this.sdkConfigService.getManifest();
  }

  @Get("/agents/:agentId/endpoints")
  getAgentEndpoints(@Param("agentId") agentId: string) {
    return this.sdkManagementService.getPublicEndpointCatalog(agentId);
  }

  @Get("/agents/:agentId/widget")
  async getWidgetConfig(
    @Param("agentId") agentId: string,
    @Query("widgetKey") widgetKey?: string,
    @Query("origin") origin?: string,
  ) {
    return this.sdkManagementService.getPublicWidgetConfig(
      agentId,
      widgetKey ?? null,
      origin ?? null,
    );
  }

  @Get("/agents/:agentId/widget/theme")
  async getWidgetTheme(
    @Param("agentId") agentId: string,
    @Query("widgetKey") widgetKey?: string,
    @Query("origin") origin?: string,
  ) {
    return this.sdkManagementService.getPublicWidgetTheme(
      agentId,
      widgetKey ?? null,
      origin ?? null,
    );
  }

  @Get("/agents/:agentId/widget/embed")
  async getWidgetEmbed(
    @Param("agentId") agentId: string,
    @Query("widgetKey") widgetKey?: string,
    @Query("origin") origin?: string,
  ) {
    return this.sdkManagementService.getPublicWidgetEmbed(
      agentId,
      widgetKey ?? null,
      origin ?? null,
    );
  }

  @Get("/agents/:agentId/rate-limits")
  async getRateLimits(@Param("agentId") agentId: string) {
    return this.sdkManagementService.getPublicRateLimits(agentId);
  }

  @Get("/agents/:agentId/security")
  async getSecurity(@Param("agentId") agentId: string) {
    return this.sdkManagementService.getPublicSecurity(agentId);
  }
}
