import { Autowired, Service } from "fragment-ts";
import { AgentStatus } from "../../../entities/enums/agent-status.enum";
import { CreateAgentDto } from "../dto/create-agent.dto";
import { UpdateAgentDto } from "../dto/update-agent.dto";
import { AgentRepository } from "../repositories/agent.repository";
import { AgentVcsService } from "../../version_control/services/agent-vcs.service";

@Service()
export class AgentService {
  @Autowired()
  private agentRepository!: AgentRepository;

  @Autowired()
  private agentVcsService!: AgentVcsService;

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
    });
  }

  async updateAgentStatus(agentId: string, status: AgentStatus) {
    return this.updateAgent(agentId, { status });
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
}
