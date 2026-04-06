import { Autowired, Service } from "fragment-ts";
import { RequestContextHolder } from "../context/request-context-holder";
import { AgentConfigRepository } from "../../modules/config/repositories/agent-config.repository";

@Service()
export class AgentClientAccessService {
  @Autowired()
  private agentConfigRepository!: AgentConfigRepository;

  async assertAgentAccess(agentId: string) {
    const apiKey = this.resolveApiKey();

    if (!apiKey) {
      throw new Error("Agent API key is required for this SDK request.");
    }

    const config = await this.agentConfigRepository.findByAgentIdAndApiKey(
      agentId,
      apiKey,
    );

    if (!config) {
      throw new Error("Invalid agent API key for the requested agent.");
    }

    RequestContextHolder.patch({
      agentId,
      apiKey,
      metadata: {
        ...(RequestContextHolder.get()?.metadata ?? {}),
        agentClientAccess: true,
      },
    });

    return config;
  }

  private resolveApiKey(): string | null {
    const context = RequestContextHolder.get();
    const directApiKey = context?.apiKey?.trim();
    if (directApiKey) {
      return directApiKey;
    }

    const authorization = context?.authorization?.trim();
    if (!authorization?.toLowerCase().startsWith("bearer ")) {
      return null;
    }

    const bearerValue = authorization.slice(7).trim();
    return bearerValue.startsWith("agt_") ? bearerValue : null;
  }
}
