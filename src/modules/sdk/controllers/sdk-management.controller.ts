import {
  Autowired,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
} from "fragment-ts";
import { UseAgentManagementPipeline } from "../../../common/decorators/use-agent-management-pipeline.decorator";
import { CreateSdkApiKeyDto } from "../dto/create-sdk-api-key.dto";
import { UpdateSdkRateLimitsDto } from "../dto/update-sdk-rate-limits.dto";
import { UpdateSdkSecurityDto } from "../dto/update-sdk-security.dto";
import { UpdateSdkWidgetDto } from "../dto/update-sdk-widget.dto";
import { SdkManagementService } from "../services/sdk-management.service";

@UseAgentManagementPipeline()
@Controller("/config/:agentId/sdk")
export class SdkManagementController {
  @Autowired()
  private sdkManagementService!: SdkManagementService;

  @Get()
  async getSdkManagement(@Param("agentId") agentId: string) {
    return this.sdkManagementService.getAgentSdkManagement(agentId);
  }

  @Post("/keys")
  async createApiKey(
    @Param("agentId") agentId: string,
    @Body() body: CreateSdkApiKeyDto,
  ) {
    return this.sdkManagementService.createApiKey(agentId, body);
  }

  @Post("/keys/:keyId/revoke")
  async revokeApiKey(
    @Param("agentId") agentId: string,
    @Param("keyId") keyId: string,
  ) {
    return this.sdkManagementService.revokeApiKey(agentId, keyId);
  }

  @Put("/rate-limits")
  async updateRateLimits(
    @Param("agentId") agentId: string,
    @Body() body: UpdateSdkRateLimitsDto,
  ) {
    return this.sdkManagementService.updateRateLimits(agentId, body);
  }

  @Put("/security")
  async updateSecurity(
    @Param("agentId") agentId: string,
    @Body() body: UpdateSdkSecurityDto,
  ) {
    return this.sdkManagementService.updateSecurity(agentId, body);
  }

  @Put("/widget")
  async updateWidget(
    @Param("agentId") agentId: string,
    @Body() body: UpdateSdkWidgetDto,
  ) {
    return this.sdkManagementService.updateWidget(agentId, body);
  }

  @Post("/widget/regenerate-key")
  async regenerateWidgetKey(@Param("agentId") agentId: string) {
    return this.sdkManagementService.regenerateWidgetKey(agentId);
  }
}
