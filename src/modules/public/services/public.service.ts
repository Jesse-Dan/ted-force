import { Autowired, Service } from "fragment-ts";
import type { Response } from "fragment-ts";
import { AgentStatus } from "../../../entities/enums/agent-status.enum";
import { WaitlistStatus } from "../../../entities/enums/waitlist-status.enum";
import type { WaitlistRequestContext } from "../../../entities/waitlist-entry.entity";
import { SseWriter } from "../../../core/ai/sse/sse-writer";
import { AgentRuntimePersistenceService } from "../../agent/services/agent-runtime-persistence.service";
import { BillingCatalogService } from "../../billing/services/billing-catalog.service";
import { BootstrapPublicAgentDto } from "../dto/bootstrap-public-agent.dto";
import type { CreateWaitlistEntryDto } from "../dto/create-waitlist-entry.dto";
import { PublicAgentRepository } from "../repositories/public-agent.repository";
import { PublicDomainRepository } from "../repositories/public-domain.repository";
import { PublicWaitlistRepository } from "../repositories/public-waitlist.repository";

@Service()
export class PublicService {
  @Autowired()
  private publicWaitlistRepository!: PublicWaitlistRepository;

  @Autowired()
  private publicAgentRepository!: PublicAgentRepository;

  @Autowired()
  private runtimePersistence!: AgentRuntimePersistenceService;

  @Autowired()
  private publicDomainRepository!: PublicDomainRepository;

  @Autowired()
  private billingCatalogService!: BillingCatalogService;

  async bootstrapAgentSessionWithSse(
    slug: string,
    payload: BootstrapPublicAgentDto,
    response: Response,
  ): Promise<void> {
    const sse = new SseWriter(response);
    sse.initialize();

    try {
      const agent = await this.publicAgentRepository.findPublicBySlug(slug);

      if (!agent || ![AgentStatus.ACTIVE, AgentStatus.DEPLOYED].includes(agent.status)) {
        throw new Error(`Public agent ${slug} is not available.`);
      }

      const conversation = await this.runtimePersistence.createConversation({
        agent,
        sessionId: payload.sessionId,
        title: `${agent.name} session`,
      });
      const version = await this.runtimePersistence.createConversationVersion({
        conversation,
      });

      sse.write({
        type: "start",
        data: {
          agentId: agent.id,
          slug: agent.slug,
        },
      });

      sse.write({
        type: "delta",
        event: "agent.bootstrap",
        data: {
          agent: {
            id: agent.id,
            name: agent.name,
            slug: agent.slug,
            description: agent.description,
            status: agent.status,
          },
          conversation: {
            id: conversation.id,
            versionId: version.id,
            versionNumber: version.versionNumber,
            sessionId: conversation.sessionId,
          },
        },
      });

      sse.write({
        type: "finish",
        event: "agent.bootstrap.completed",
        data: {
          conversationId: conversation.id,
          conversationVersionId: version.id,
        },
      });
      sse.done();
    } catch (error) {
      sse.write({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to bootstrap public agent session.",
        },
      });
      sse.done();
    }
  }

  async submitWaitlistWithSse(
    payload: CreateWaitlistEntryDto,
    requestContext: WaitlistRequestContext,
    response: Response,
  ): Promise<void> {
    const sse = new SseWriter(response);
    sse.initialize();

    try {
      sse.write({
        type: "start",
        data: {
          status: "accepted",
        },
      });

      const normalizedEmail = payload.email.trim().toLowerCase();
      const existingEntry =
        await this.publicWaitlistRepository.findByEmail(normalizedEmail);

      const mergedContext: WaitlistRequestContext = {
        ...(existingEntry?.requestContext ?? {}),
        ...requestContext,
        headers: {
          ...(existingEntry?.requestContext?.headers ?? {}),
          ...(requestContext.headers ?? {}),
        },
      };

      const entry = await this.publicWaitlistRepository.save({
        ...existingEntry,
        email: normalizedEmail,
        fullName: payload.fullName ?? existingEntry?.fullName ?? null,
        companyName: payload.companyName ?? existingEntry?.companyName ?? null,
        jobTitle: payload.jobTitle ?? existingEntry?.jobTitle ?? null,
        useCase: payload.useCase ?? existingEntry?.useCase ?? null,
        teamSize: payload.teamSize ?? existingEntry?.teamSize ?? null,
        notes: this.buildNotes(payload, existingEntry?.notes ?? null),
        status: existingEntry?.status ?? WaitlistStatus.PENDING,
        requestContext: mergedContext,
      });

      sse.write({
        type: "delta",
        event: "waitlist.received",
        data: {
          entryId: entry.id,
          email: entry.email,
          status: entry.status,
        },
      });

      sse.write({
        type: "finish",
        event: "waitlist.completed",
        data: {
          entryId: entry.id,
          alreadyExisted: Boolean(existingEntry),
          status: entry.status,
        },
      });
      sse.done();
    } catch (error) {
      sse.write({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to submit waitlist request.",
        },
      });
      sse.done();
    }
  }

  private buildNotes(
    payload: CreateWaitlistEntryDto,
    existingNotes: string | null,
  ): string | null {
    const notes = [existingNotes, payload.notes]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join("\n\n");

    const labels = [payload.source, payload.interestLabel]
      .filter((value): value is string => Boolean(value && value.trim()))
      .map((value) => `[${value.trim()}]`);

    if (labels.length === 0) {
      return notes || null;
    }

    const labelBlock = labels.join(" ");
    return [labelBlock, notes].filter(Boolean).join("\n");
  }

  async getDomains() {
    return this.publicDomainRepository.listDomainAgents();
  }

  async getDomainTemplates() {
    return this.publicDomainRepository.listTemplates();
  }

  async getStatus() {
    return {
      status: "ok",
      transport: "sse",
      runtime: "stateful-agent",
      timestamp: new Date().toISOString(),
    };
  }

  getBillingCatalog() {
    return this.billingCatalogService.getPublicCatalog();
  }
}
