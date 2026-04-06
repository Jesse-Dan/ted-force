import {
  Autowired,
  Body,
  Controller,
  Param,
  Post,
  Res,
  Response,
} from "fragment-ts";
import { UseAgentRequestPipeline } from "../../../common/decorators/use-agent-request-pipeline.decorator";
import { AgentRuntimeRequestDto } from "../../agent/dto/agent-runtime-request.dto";
import { ApiRuntimeService } from "../services/api-runtime.service";

@UseAgentRequestPipeline()
@Controller("/runtime")
export class ApiRuntimeController {
  @Autowired()
  private apiRuntimeService!: ApiRuntimeService;

  @Post("/agents/:agentId")
  async respondWithSse(
    @Param("agentId") agentId: string,
    @Body() body: AgentRuntimeRequestDto,
    @Res() response: Response,
  ) {
    await this.apiRuntimeService.respondWithSse(agentId, body, response);
    return response;
  }
}
