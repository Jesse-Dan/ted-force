import { Autowired, Service } from "fragment-ts";
import type { Response } from "fragment-ts";
import { AgentRuntimeRequestDto } from "../../agent/dto/agent-runtime-request.dto";
import { AgentRuntimeService } from "../../agent/services/agent-runtime.service";

@Service()
export class ApiRuntimeService {
  @Autowired()
  private agentRuntimeService!: AgentRuntimeService;

  async respondWithSse(
    agentId: string,
    request: AgentRuntimeRequestDto,
    response: Response,
  ): Promise<void> {
    await this.agentRuntimeService.respondWithSse(agentId, request, response);
  }
}
