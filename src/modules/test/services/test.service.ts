import { Autowired, Service } from "fragment-ts";
import type { Response } from "fragment-ts";
import { AgentRuntimeService } from "../../agent/services/agent-runtime.service";
import { RunAgentTestDto } from "../dto/run-agent-test.dto";

@Service()
export class TestService {
  @Autowired()
  private agentRuntimeService!: AgentRuntimeService;

  async runAgentTestWithSse(
    agentId: string,
    payload: RunAgentTestDto,
    response: Response,
  ) {
    return this.agentRuntimeService.respondWithSse(
      agentId,
      {
        ...payload,
        mock: true,
      },
      response,
    );
  }
}
