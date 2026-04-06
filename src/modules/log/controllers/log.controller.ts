import { Autowired, Controller, Get, Param } from "fragment-ts";
import { UseAgentManagementPipeline } from "../../../common/decorators/use-agent-management-pipeline.decorator";
import { LogService } from "../services/log.service";

@UseAgentManagementPipeline()
@Controller("/log")
export class LogController {
  @Autowired()
  private logService!: LogService;

  @Get("/agents/:agentId/activity")
  async getAgentActivity(@Param("agentId") agentId: string) {
    return this.logService.getAgentActivity(agentId);
  }

  @Get("/agents/:agentId/api-calls")
  async getAgentApiCalls(@Param("agentId") agentId: string) {
    return this.logService.getAgentApiCalls(agentId);
  }
}
