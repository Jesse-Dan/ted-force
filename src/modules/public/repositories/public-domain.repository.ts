import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { Agent } from "../../../entities/agent.entity";
import { AgentStatus } from "../../../entities/enums/agent-status.enum";
import { DomainTemplate } from "../../../entities/domain-template.entity";

@FragmentRepository()
export class PublicDomainRepository {
  @InjectRepository(DomainTemplate)
  private domainTemplateRepository!: Repository<DomainTemplate>;

  @InjectRepository(Agent)
  private agentRepository!: Repository<Agent>;

  async listTemplates() {
    return this.domainTemplateRepository.find({
      order: {
        title: "ASC",
      },
    });
  }

  async listDomainAgents() {
    const templates = await this.listTemplates();
    const agents = await this.agentRepository.find({
      relations: {
        organization: true,
      },
      order: {
        updatedAt: "DESC",
      },
    });

    const eligibleAgents = agents
      .filter((agent) =>
        [AgentStatus.ACTIVE, AgentStatus.DEPLOYED].includes(agent.status),
      )
      .filter(
        (agent) =>
          this.readVisibility(agent) === "domain-available" &&
          (agent.organization?.metadata?.buildType ?? "none") === "digitwhale",
      )
      .reduce<Record<string, Agent>>((accumulator, agent) => {
        accumulator[agent.id] = agent;
        return accumulator;
      }, {});

    return templates
      .map((template) => {
        const agent = template.agentReferenceId
          ? eligibleAgents[template.agentReferenceId]
          : undefined;

        if (!agent) {
          return null;
        }

        return {
          id: template.id,
          icon: template.icon,
          title: template.title,
          description: template.description,
          complexity: template.complexity,
          useCases: template.useCases ?? [],
          dataRequirements: template.dataRequirements ?? null,
          agentReferenceId: template.agentReferenceId ?? null,
          agent: {
            id: agent.id,
            slug: agent.slug,
            name: agent.name,
            description: agent.description ?? "",
            status: agent.status,
            visibility: this.readVisibility(agent),
            domainLabel: agent.domainLabel ?? null,
            coverImageUrl: agent.coverImageUrl ?? null,
            updatedAt: agent.updatedAt,
            createdAt: agent.createdAt,
            organization: agent.organization
              ? {
                  id: agent.organization.id,
                  name: agent.organization.name,
                  slug: agent.organization.slug ?? null,
                  buildType: agent.organization.metadata?.buildType ?? "none",
                }
              : null,
          },
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }

  private readVisibility(agent: Agent) {
    const custom = agent.metadata?.custom;
    if (!custom || typeof custom !== "object") {
      return "private";
    }

    const visibility = (custom as Record<string, unknown>).visibility;
    return typeof visibility === "string" ? visibility : "private";
  }
}
