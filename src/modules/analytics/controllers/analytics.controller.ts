import { Autowired, Body, Controller, Delete, Get, Param, Patch, Post, Put } from "fragment-ts";
import { UseAgentManagementPipeline } from "../../../common/decorators/use-agent-management-pipeline.decorator";
import { UpsertAgentAnalyticsDto } from "../dto/upsert-agent-analytics.dto";
import { AnalyticsCommandService } from "../services/analytics-command.service";
import { AnalyticsQueryService } from "../services/analytics-query.service";

@UseAgentManagementPipeline()
@Controller("/analytics")
export class AnalyticsController {
  @Autowired()
  private analyticsQueryService!: AnalyticsQueryService;

  @Autowired()
  private analyticsCommandService!: AnalyticsCommandService;

  @Get("/agents/:agentId")
  async getAgentAnalytics(@Param("agentId") agentId: string) {
    return this.analyticsQueryService.getAgentAnalytics(agentId);
  }

  @Put("/agents/:agentId")
  async upsertAgentAnalytics(
    @Param("agentId") agentId: string,
    @Body() body: UpsertAgentAnalyticsDto,
  ) {
    return this.analyticsCommandService.upsertAgentAnalytics(agentId, body);
  }

  @Post("/agents/:agentId")
  async createAgentAnalytics(
    @Param("agentId") agentId: string,
    @Body() body: UpsertAgentAnalyticsDto,
  ) {
    return this.analyticsCommandService.upsertAgentAnalytics(agentId, body);
  }

  @Patch("/agents/:agentId")
  async patchAgentAnalytics(
    @Param("agentId") agentId: string,
    @Body() body: UpsertAgentAnalyticsDto,
  ) {
    return this.analyticsCommandService.upsertAgentAnalytics(agentId, body);
  }

  @Delete("/agents/:agentId")
  async deleteAgentAnalytics(@Param("agentId") agentId: string) {
    return this.analyticsCommandService.deleteAgentAnalytics(agentId);
  }
}
