import {
  Autowired,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  Response,
} from "fragment-ts";
import { UseAgentRequestPipeline } from "../../../common/decorators/use-agent-request-pipeline.decorator";
import { AgentRuntimeRequestDto } from "../../agent/dto/agent-runtime-request.dto";
import { ApiService } from "../services/api.service";

@UseAgentRequestPipeline()
@Controller("/api")
export class ApiController {
  @Autowired()
  private apiService!: ApiService;

  @Get("/agents/:agentId/calls")
  async getAgentApiCalls(@Param("agentId") agentId: string) {
    return this.apiService.getAgentApiCalls(agentId);
  }

  @Post("/generate")
  async generate(
    @Body() body: AgentRuntimeRequestDto & { agentId: string },
    @Res() response: Response,
  ) {
    await this.apiService.generate(body.agentId, body, response);
    return response;
  }

  @Post("/litegen")
  async litegen(
    @Body()
    body: {
      agentId: string;
      sessionId?: string;
      prompt: string;
      characteristics?: string[];
      mock?: boolean;
    },
    @Res() response: Response,
  ) {
    await this.apiService.litegen(body.agentId, body, response);
    return response;
  }

  @Get("/history")
  async history(@Query("sessionId") sessionId: string) {
    return this.apiService.getHistory(sessionId);
  }

  @Get("/messages")
  async messages(@Query("conversationId") conversationId: string) {
    return this.apiService.getMessages(conversationId);
  }

  @Post("/trigger")
  async trigger(@Body() body: { agentId: string } & Record<string, unknown>) {
    return this.apiService.trigger(body.agentId, body);
  }
}
