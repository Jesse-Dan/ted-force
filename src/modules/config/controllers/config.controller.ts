import { Autowired, Body, Controller, Get, Param, Put } from "fragment-ts";
import { UseAgentManagementPipeline } from "../../../common/decorators/use-agent-management-pipeline.decorator";
import { UpsertAgentConfigDto } from "../dto/upsert-agent-config.dto";
import { ConfigService } from "../services/config.service";

@UseAgentManagementPipeline()
@Controller("/config")
export class ConfigController {
  @Autowired()
  private configService!: ConfigService;

  @Get("/:agentId")
  async getConfig(@Param("agentId") agentId: string) {
    return this.configService.getAgentConfig(agentId);
  }

  @Put("/:agentId")
  async upsertConfig(
    @Param("agentId") agentId: string,
    @Body() body: UpsertAgentConfigDto,
  ) {
    return this.configService.upsertAgentConfig(agentId, body);
  }
}
