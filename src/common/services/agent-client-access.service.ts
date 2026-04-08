import { createHash } from "node:crypto";
import { Autowired, Service } from "fragment-ts";
import { RequestContextHolder } from "../context/request-context-holder";
import { AgentSdkApiKeyRepository } from "../../modules/sdk/repositories/agent-sdk-api-key.repository";

type SdkApiScope = "read" | "write" | "admin";

@Service()
export class AgentClientAccessService {
  @Autowired()
  private agentSdkApiKeyRepository!: AgentSdkApiKeyRepository;

  async assertAgentAccess(agentId: string, requiredScope: SdkApiScope = "read") {
    const apiKey = this.resolveApiKey();

    if (!apiKey) {
      throw new Error("Agent API key is required for this SDK request.");
    }

    const tokenHash = createHash("sha256").update(apiKey).digest("hex");
    const sdkKey = await this.agentSdkApiKeyRepository.findActiveByAgentIdAndHash(
      agentId,
      tokenHash,
    );

    if (sdkKey) {
      if (!this.hasScope(sdkKey.scopes, requiredScope)) {
        throw new Error(`This API key does not include the ${requiredScope} scope.`);
      }

      await this.agentSdkApiKeyRepository.save({
        ...sdkKey,
        lastUsedAt: new Date(),
      });

      RequestContextHolder.patch({
        agentId,
        apiKey,
        metadata: {
          ...(RequestContextHolder.get()?.metadata ?? {}),
          agentClientAccess: true,
          sdkApiKeyId: sdkKey.id,
          sdkScopes: sdkKey.scopes,
        },
      });

      return sdkKey;
    }

    throw new Error("Invalid agent SDK key for the requested agent.");
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

  private hasScope(scopes: string[], requiredScope: SdkApiScope) {
    if (scopes.includes("admin")) {
      return true;
    }

    return scopes.includes(requiredScope);
  }
}
