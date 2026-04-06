import { Autowired, Service } from "fragment-ts";
import type { Response } from "fragment-ts";
import { AgentRuntimeRequestDto } from "../../agent/dto/agent-runtime-request.dto";
import { AgentRuntimeService } from "../../agent/services/agent-runtime.service";
import { MarketplaceRepository } from "../repositories/marketplace.repository";

@Service()
export class MarketplaceService {
  @Autowired()
  private marketplaceRepository!: MarketplaceRepository;

  @Autowired()
  private agentRuntimeService!: AgentRuntimeService;

  async getAgents() {
    const agents = await this.marketplaceRepository.listPublicAgents();
    const responses: Array<Record<string, unknown>> = [];

    for (const agent of agents) {
      const instances = await this.marketplaceRepository.findPublicInstances(agent.id);
      if (instances.length === 0) continue;

      for (const instance of instances) {
        const parameter = await this.marketplaceRepository.findParameterByCommitHash(
          agent.id,
          instance.commitHash,
        );

        responses.push({
          name: agent.name,
          description: agent.description ?? "",
          agentId: agent.id,
          org: agent.organization?.name ?? "Unverified",
          updatedAt: instance.version.deployedAt ?? agent.updatedAt,
          stars: agent.metadata?.toolCount ?? 0,
          version: instance.version.version,
          deployedAt: instance.version.deployedAt,
          niche: parameter?.niche ?? null,
          instanceId: instance.id,
          commitHash: instance.commitHash ?? null,
        });
      }
    }

    return responses;
  }

  async getAgentBySlug(slug: string) {
    const agent = await this.marketplaceRepository.findPublicAgentBySlug(slug);
    if (!agent) {
      throw new Error(`Marketplace agent ${slug} not found.`);
    }

    const instances = await this.marketplaceRepository.findPublicInstances(agent.id);
    const current = instances[0] ?? null;
    const parameter = current?.commitHash
      ? await this.marketplaceRepository.findParameterByCommitHash(agent.id, current.commitHash)
      : null;

    return {
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      description: agent.description ?? "",
      organization: agent.organization?.name ?? "Unverified",
      status: agent.status,
      updatedAt: agent.updatedAt,
      currentInstance: current
        ? {
            id: current.id,
            commitHash: current.commitHash ?? null,
            version: current.version?.version ?? null,
            deployedAt: current.version?.deployedAt ?? null,
          }
        : null,
      profile: {
        niche: parameter?.niche ?? null,
        overview: parameter?.overview ?? null,
        documentation: parameter?.documentation ?? null,
      },
    };
  }

  async prompt(agentId: string, payload: AgentRuntimeRequestDto, response: Response) {
    const agent = await this.marketplaceRepository.findPublicAgentById(agentId);
    if (!agent) {
      throw new Error("Agent is not publicly available.");
    }

    if (payload.stream === false) {
      return this.agentRuntimeService.respond(agentId, payload);
    }

    await this.agentRuntimeService.respondWithSse(agentId, payload, response);
    return response;
  }
}
