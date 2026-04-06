import { Autowired, Body, Controller, Delete, Get, Param, Put, Query } from "fragment-ts";
import { UseAgentManagementPipeline } from "../../../common/decorators/use-agent-management-pipeline.decorator";
import { PreferencesService } from "../services/preferences.service";
import { UpsertCapabilityProfileDto } from "../dto/upsert-capability-profile.dto";
import { UpsertContextRuleSetDto } from "../dto/upsert-context-rule-set.dto";
import { UpsertAgentParameterDto } from "../dto/upsert-agent-parameter.dto";
import { UpsertVoiceProfileDto } from "../dto/upsert-voice-profile.dto";

@UseAgentManagementPipeline()
@Controller("/preferences")
export class PreferencesController {
  @Autowired()
  private preferencesService!: PreferencesService;

  @Get("/parameters")
  async getPreferences(@Query("agentId") agentId: string) {
    return this.preferencesService.getPreferences(agentId);
  }

  @Put("/parameters")
  async upsertParameters(
    @Query("agentId") agentId: string,
    @Body() body: UpsertAgentParameterDto,
  ) {
    return this.preferencesService.upsertParameter(agentId, body);
  }

  @Delete("/parameters")
  async deleteParameters(@Query("agentId") agentId: string) {
    return this.preferencesService.deleteParameter(agentId);
  }

  @Put("/capability/:agentId")
  async upsertCapability(
    @Param("agentId") agentId: string,
    @Body() body: UpsertCapabilityProfileDto,
  ) {
    return this.preferencesService.upsertCapability(agentId, body);
  }

  @Put("/voice-tone/:agentId")
  async upsertVoice(
    @Param("agentId") agentId: string,
    @Body() body: UpsertVoiceProfileDto,
  ) {
    return this.preferencesService.upsertVoice(agentId, body);
  }

  @Put("/persona/:agentId")
  async upsertPersona(
    @Param("agentId") agentId: string,
    @Body() body: UpsertAgentParameterDto,
  ) {
    return this.preferencesService.upsertParameter(agentId, {
      persona: body.persona,
    });
  }

  @Put("/niche/:agentId")
  async upsertNiche(
    @Param("agentId") agentId: string,
    @Body() body: UpsertAgentParameterDto,
  ) {
    return this.preferencesService.upsertParameter(agentId, {
      niche: body.niche,
    });
  }

  @Put("/overview-documentation/:agentId")
  async upsertOverviewDocumentation(
    @Param("agentId") agentId: string,
    @Body() body: UpsertAgentParameterDto,
  ) {
    return this.preferencesService.upsertParameter(agentId, {
      overview: body.overview,
      documentation: body.documentation,
      corePrompts: body.corePrompts,
      responseFormat: body.responseFormat,
    });
  }

  @Put("/relative-values/:agentId")
  async upsertContextRules(
    @Param("agentId") agentId: string,
    @Body() body: UpsertContextRuleSetDto,
  ) {
    return this.preferencesService.upsertContextRules(agentId, body);
  }
}
