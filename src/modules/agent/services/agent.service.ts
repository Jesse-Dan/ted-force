import { Autowired, Service } from "fragment-ts";
import { AgentMetadata } from "../../../entities/agent.entity";
import { AgentStatus } from "../../../entities/enums/agent-status.enum";
import { RequestContextHolder } from "../../../common/context/request-context-holder";
import { CreateAgentDto } from "../dto/create-agent.dto";
import { UpdateAgentDto } from "../dto/update-agent.dto";
import { AgentRepository } from "../repositories/agent.repository";
import { AgentVcsService } from "../../version_control/services/agent-vcs.service";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { UserAccountRepository } from "../../auth/repositories/user-account.repository";

@Service()
export class AgentService {
  @Autowired()
  private agentRepository!: AgentRepository;

  @Autowired()
  private agentVcsService!: AgentVcsService;

  @Autowired()
  private organizationRepository!: OrganizationRepository;

  @Autowired()
  private userAccountRepository!: UserAccountRepository;

  async listAgents(filters?: {
    organizationId?: string;
    ownerUserId?: string;
  }) {
    return this.agentRepository.list(filters);
  }

  async getAgentById(agentId: string) {
    return this.agentRepository.findById(agentId);
  }

  async createAgent(payload: CreateAgentDto) {
    await this.assertDomainVisibilityEligibilityForOrganization(
      payload.organizationId ?? null,
      payload.visibility,
    );

    const slug = await this.resolveUniqueSlug(payload.slug ?? payload.name);
    const agent = await this.agentRepository.save({
      name: payload.name.trim(),
      slug,
      description: payload.description?.trim() ?? null,
      domainLabel: payload.domainLabel?.trim() ?? null,
      organizationId: payload.organizationId ?? null,
      ownerUserId: payload.ownerUserId ?? null,
      status: payload.status ?? AgentStatus.DRAFT,
      version: "1.0.0",
      metadata: this.mergeVisibilityMetadata(null, payload.visibility),
    });

    await this.agentVcsService.bootstrapAgentRepository(agent.id, {
      userId: agent.ownerUserId ?? payload.ownerUserId ?? null,
      userName: payload.name.trim(),
    });

    return agent;
  }

  async updateAgent(agentId: string, payload: UpdateAgentDto) {
    const existing = await this.agentRepository.findById(agentId);

    if (!existing) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const nextSlug =
      payload.slug && payload.slug !== existing.slug
        ? await this.resolveUniqueSlug(payload.slug, existing.id)
        : existing.slug;

    const nextVisibility =
      payload.visibility === undefined
        ? this.readVisibility(existing.metadata ?? null)
        : payload.visibility;
    const nextOrganizationId =
      payload.organizationId === undefined
        ? existing.organizationId ?? null
        : payload.organizationId;

    await this.assertDomainVisibilityEligibilityForOrganization(
      nextOrganizationId,
      nextVisibility,
    );

    if (payload.status !== undefined) {
      await this.assertBlockedTransitionPermissions(
        existing.status,
        payload.status,
        payload.blockReason,
      );
    }

    let nextMetadata = this.mergeVisibilityMetadata(
      existing.metadata ?? null,
      payload.visibility,
    );

    if (payload.status !== undefined) {
      nextMetadata = this.mergeBlockReasonMetadata(
        nextMetadata,
        existing.status,
        payload.status,
        payload.blockReason,
      );
    }

    return this.agentRepository.save({
      ...existing,
      name: payload.name?.trim() ?? existing.name,
      slug: nextSlug,
      description:
        payload.description === undefined
          ? existing.description
          : payload.description?.trim() ?? null,
      domainLabel:
        payload.domainLabel === undefined
          ? existing.domainLabel
          : payload.domainLabel?.trim() ?? null,
      organizationId:
        payload.organizationId === undefined
          ? existing.organizationId
          : payload.organizationId,
      ownerUserId:
        payload.ownerUserId === undefined
          ? existing.ownerUserId
          : payload.ownerUserId,
      status: payload.status ?? existing.status,
      metadata: nextMetadata,
    });
  }

  async updateAgentStatus(
    agentId: string,
    status: AgentStatus,
    blockReason?: string,
  ) {
    const existing = await this.agentRepository.findById(agentId);
    if (!existing) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    await this.assertBlockedTransitionPermissions(
      existing.status,
      status,
      blockReason,
    );

    const metadata = this.mergeBlockReasonMetadata(
      existing.metadata ?? null,
      existing.status,
      status,
      blockReason,
    );

    return this.agentRepository.save({
      ...existing,
      status,
      metadata,
    });
  }

  async duplicateAgent(agentId: string, name?: string) {
    const existing = await this.agentRepository.findById(agentId);
    if (!existing) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const duplicateName = name?.trim() || `${existing.name} Copy`;
    const slug = await this.resolveUniqueSlug(duplicateName);

    return this.agentRepository.save({
      name: duplicateName,
      slug,
      description: existing.description ?? null,
      domainLabel: existing.domainLabel ?? null,
      organizationId: existing.organizationId ?? null,
      ownerUserId: existing.ownerUserId ?? null,
      status: AgentStatus.DRAFT,
      version: existing.version,
      metadata: existing.metadata ?? null,
    });
  }

  async deleteAgent(agentId: string) {
    const existing = await this.agentRepository.findById(agentId);
    if (!existing) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    await this.agentRepository.deleteById(agentId);
    return { id: agentId, deleted: true };
  }

  private async resolveUniqueSlug(rawValue: string, currentAgentId?: string): Promise<string> {
    const base = this.slugify(rawValue);
    let candidate = base;
    let counter = 1;

    while (true) {
      const existing = await this.agentRepository.findBySlug(candidate);

      if (!existing || existing.id === currentAgentId) {
        return candidate;
      }

      counter += 1;
      candidate = `${base}-${counter}`;
    }
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `agent-${Date.now()}`;
  }

  private async assertDomainVisibilityEligibilityForOrganization(
    organizationId: string | null,
    visibility: UpdateAgentDto["visibility"] | CreateAgentDto["visibility"] | undefined,
  ) {
    if (visibility !== "domain-available") {
      return;
    }

    if (!organizationId) {
      throw new Error(
        "Only organization-owned agents can be marked as domain-available.",
      );
    }

    const organization = await this.organizationRepository.findById(organizationId);
    const buildType = organization?.metadata?.buildType ?? "none";

    if (buildType !== "digitwhale") {
      throw new Error(
        "Only organizations with buildType `digitwhale` can mark agents as domain-available.",
      );
    }
  }

  private mergeVisibilityMetadata(
    metadata: AgentMetadata | null | undefined,
    visibility: UpdateAgentDto["visibility"] | CreateAgentDto["visibility"] | undefined,
  ): AgentMetadata | null {
    if (visibility === undefined) {
      return metadata ?? null;
    }

    const nextCustom: Record<string, unknown> = {
      ...(metadata?.custom ?? {}),
    };

    if (visibility === null) {
      delete nextCustom.visibility;
    } else {
      nextCustom.visibility = visibility;
    }

    return {
      ...(metadata ?? {}),
      custom: nextCustom,
    };
  }

  private mergeBlockReasonMetadata(
    metadata: AgentMetadata | null,
    previousStatus: AgentStatus,
    nextStatus: AgentStatus,
    blockReason?: string,
  ): AgentMetadata | null {
    if (previousStatus === nextStatus && blockReason === undefined) {
      return metadata ?? null;
    }

    const nextCustom: Record<string, unknown> = {
      ...(metadata?.custom ?? {}),
    };

    if (nextStatus === AgentStatus.BLOCKED) {
      if (previousStatus !== AgentStatus.BLOCKED) {
        nextCustom.blockReason = (blockReason ?? "").trim();
      } else if (blockReason !== undefined) {
        const normalizedReason = blockReason.trim();
        if (normalizedReason.length === 0) {
          delete nextCustom.blockReason;
        } else {
          nextCustom.blockReason = normalizedReason;
        }
      }
    } else {
      delete nextCustom.blockReason;
    }

    return {
      ...(metadata ?? {}),
      custom: nextCustom,
    };
  }

  private async assertBlockedTransitionPermissions(
    previousStatus: AgentStatus,
    nextStatus: AgentStatus,
    blockReason?: string,
  ) {
    const togglesBlockedState =
      previousStatus === AgentStatus.BLOCKED || nextStatus === AgentStatus.BLOCKED;

    if (!togglesBlockedState) {
      return;
    }

    const isPlatformAdmin = await this.isRequesterPlatformAdmin();
    if (!isPlatformAdmin) {
      throw new Error(
        "Only platform admins can toggle blocked status on agents.",
      );
    }

    if (
      previousStatus !== AgentStatus.BLOCKED &&
      nextStatus === AgentStatus.BLOCKED &&
      !(blockReason ?? "").trim()
    ) {
      throw new Error(
        "A block reason is required when setting an agent to blocked.",
      );
    }
  }

  private async isRequesterPlatformAdmin(): Promise<boolean> {
    const userId = RequestContextHolder.get()?.userId;
    if (!userId) {
      return false;
    }

    const user = await this.userAccountRepository.findById(userId).catch(() => null);
    return Boolean(user?.isPlatformAdmin);
  }

  private readVisibility(
    metadata: AgentMetadata | null,
  ): "private" | "public" | "internal" | "domain-available" | null {
    const visibility = metadata?.custom?.visibility;
    return typeof visibility === "string"
      ? (visibility as "private" | "public" | "internal" | "domain-available")
      : null;
  }
}
