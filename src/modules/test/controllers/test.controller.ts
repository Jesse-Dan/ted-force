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
import { RunAgentTestDto } from "../dto/run-agent-test.dto";
import { TestService } from "../services/test.service";

@UseAgentRequestPipeline()
@Controller("/test")
export class TestController {
  @Autowired()
  private testService!: TestService;

  @Post("/agents/:agentId/runtime")
  async runAgentTest(
    @Param("agentId") agentId: string,
    @Body() body: RunAgentTestDto,
    @Res() response: Response,
  ) {
    await this.testService.runAgentTestWithSse(agentId, body, response);
    return response;
  }
}
