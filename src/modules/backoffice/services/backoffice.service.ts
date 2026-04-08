import {
  Autowired,
  InjectRepository,
  Repository,
  Service,
} from "fragment-ts";
import { In } from "typeorm";
import { RequestContextHolder } from "../../../common/context/request-context-holder";
import { DomainTemplate } from "../../../entities/domain-template.entity";
import { AgentStatus } from "../../../entities/enums/agent-status.enum";
import { UserAccountRepository } from "../../auth/repositories/user-account.repository";
import { AgentService } from "../../agent/services/agent.service";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { OrganizationService } from "../../organization/services/organization.service";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";

@Service()
export class BackofficeService {
  @Autowired()
  private userAccountRepository!: UserAccountRepository;

  @Autowired()
  private agentRepository!: AgentRepository;

  @Autowired()
  private organizationRepository!: OrganizationRepository;

  @Autowired()
  private agentService!: AgentService;

  @Autowired()
  private organizationService!: OrganizationService;

  @InjectRepository(DomainTemplate)
  private domainTemplateRepository!: Repository<DomainTemplate>;

  async getAccess() {
    const context = RequestContextHolder.get();
    const userId = context?.userId;
    const user = userId
      ? await this.userAccountRepository.findById(userId)
      : null;

    return {
      userId: user?.id ?? null,
      email: user?.email ?? null,
      platformAdmin: Boolean(user?.isPlatformAdmin),
    };
  }

  async listUsers() {
    return this.userAccountRepository.listAll();
  }

  async listAgents() {
    const agents = await this.agentRepository.list();
    const templates = await this.listDomainTemplatesByAgentIds(
      agents.map((agent) => agent.id),
    );

    return agents.map((agent) => ({
      ...agent,
      domainTemplate: templates[agent.id] ?? null,
    }));
  }

  async listOrganizations() {
    return this.organizationRepository.findAllForBilling();
  }

  async updateAgentStatus(
    agentId: string,
    status: AgentStatus.ACTIVE | AgentStatus.BLOCKED,
    blockReason?: string,
  ) {
    const agent = await this.agentService.updateAgentStatus(
      agentId,
      status,
      blockReason,
    );
    return this.attachDomainTemplate(agent);
  }

  async updateAgentVisibility(
    agentId: string,
    visibility: "private" | "public" | "internal" | "domain-available",
  ) {
    if (visibility === "domain-available") {
      const template = await this.getAgentDomainTemplate(agentId);
      const hasRequiredTemplate =
        Boolean(template?.icon?.trim()) &&
        Boolean(template?.title?.trim()) &&
        Boolean(template?.description?.trim()) &&
        Boolean(template?.complexity?.trim()) &&
        (template?.useCases?.filter((entry) => entry.trim()).length ?? 0) > 0;

      if (!hasRequiredTemplate) {
        throw new Error(
          "Domain template details are required before enabling domain exposure.",
        );
      }
    }

    const agent = await this.agentService.updateAgent(agentId, { visibility });
    return this.attachDomainTemplate(agent);
  }

  async updateOrganizationBuildType(
    organizationId: string,
    buildType: "none" | "digitwhale",
  ) {
    return this.organizationService.updateOrganization(organizationId, { buildType });
  }

  async listAdminAccessUsers() {
    const users = await this.userAccountRepository.listAll();

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      displayName: user.displayName ?? null,
      isPlatformAdmin: Boolean(user.isPlatformAdmin),
      memberships: user.memberships ?? [],
      updatedAt: user.updatedAt,
      createdAt: user.createdAt,
    }));
  }

  async setUserPlatformAdmin(userId: string, isPlatformAdmin: boolean) {
    const user = await this.userAccountRepository.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found.`);
    }

    return this.userAccountRepository.save({
      ...user,
      isPlatformAdmin,
    });
  }

  async getAgentDomainTemplate(agentId: string) {
    return this.domainTemplateRepository.findOne({
      where: {
        agentReferenceId: agentId,
      },
    });
  }

  async upsertAgentDomainTemplate(
    agentId: string,
    payload: {
      icon: string;
      title: string;
      description: string;
      complexity: string;
      useCases: string[];
      dataRequirements?: string | null;
    },
  ) {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const icon = payload.icon.trim();
    const title = payload.title.trim();
    const description = payload.description.trim();
    const complexity = payload.complexity.trim();
    const useCases = (payload.useCases ?? [])
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const dataRequirements =
      payload.dataRequirements === undefined
        ? null
        : (payload.dataRequirements ?? "").trim() || null;

    if (!icon || !title || !description || !complexity || useCases.length === 0) {
      throw new Error(
        "Domain template requires icon, title, description, complexity, and at least one use case.",
      );
    }

    const existing = await this.domainTemplateRepository.findOne({
      where: {
        agentReferenceId: agentId,
      },
    });

    const templateId = existing?.id ?? `agent-${agentId}`;

    return this.domainTemplateRepository.save({
      ...existing,
      id: templateId.slice(0, 100),
      icon,
      title,
      description,
      complexity,
      useCases,
      dataRequirements,
      agentReferenceId: agentId,
    });
  }

  private async attachDomainTemplate<T extends { id?: string | null }>(agent: T) {
    if (!agent?.id) {
      return {
        ...agent,
        domainTemplate: null,
      };
    }

    const template = await this.domainTemplateRepository.findOne({
      where: {
        agentReferenceId: agent.id,
      },
    });

    return {
      ...agent,
      domainTemplate: template ?? null,
    };
  }

  private async listDomainTemplatesByAgentIds(agentIds: string[]) {
    if (agentIds.length === 0) {
      return {};
    }

    const templates = await this.domainTemplateRepository.find({
      where: {
        agentReferenceId: In(agentIds),
      },
      order: {
        updatedAt: "DESC",
      },
    });

    return templates.reduce<Record<string, DomainTemplate>>((accumulator, template) => {
      if (template.agentReferenceId && !accumulator[template.agentReferenceId]) {
        accumulator[template.agentReferenceId] = template;
      }

      return accumulator;
    }, {});
  }
}
