import { Autowired, Service } from "fragment-ts";
import type { Response } from "fragment-ts";
import { ApiCallLogRepository } from "../repositories/api-call-log.repository";
import { ApiRuntimeRepository } from "../../api-runtime/repositories/api-runtime.repository";
import { ApiRuntimeService } from "../../api-runtime/services/api-runtime.service";
import { AgentRuntimeRequestDto } from "../../agent/dto/agent-runtime-request.dto";

@Service()
export class ApiService {
  @Autowired()
  private apiCallLogRepository!: ApiCallLogRepository;

  @Autowired()
  private apiRuntimeRepository!: ApiRuntimeRepository;

  @Autowired()
  private apiRuntimeService!: ApiRuntimeService;

  async getAgentApiCalls(agentId: string) {
    return this.apiCallLogRepository.findByAgentId(agentId);
  }

  async generate(agentId: string, request: AgentRuntimeRequestDto, response: Response) {
    await this.apiRuntimeService.respondWithSse(agentId, request, response);
  }

  async litegen(
    agentId: string,
    payload: {
      sessionId?: string;
      prompt: string;
      characteristics?: string[];
      mock?: boolean;
    },
    response: Response,
  ) {
    const input = [
      payload.characteristics?.length
        ? `Characteristics: ${payload.characteristics.join(", ")}`
        : null,
      payload.prompt,
    ]
      .filter(Boolean)
      .join("\n\n");

    await this.apiRuntimeService.respondWithSse(
      agentId,
      {
        input,
        sessionId: payload.sessionId,
        mock: payload.mock,
      },
      response,
    );
  }

  async getHistory(sessionId: string) {
    return this.apiRuntimeRepository.findConversationsBySessionId(sessionId);
  }

  async getMessages(conversationId: string) {
    return this.apiRuntimeRepository.findMessagesByConversationId(conversationId);
  }

  async trigger(agentId: string, payload: Record<string, unknown>) {
    return {
      accepted: true,
      agentId,
      trigger: payload.trigger ?? "unknown",
      functionCall: payload.functionCall ?? null,
      receivedAt: new Date().toISOString(),
    };
  }
}
