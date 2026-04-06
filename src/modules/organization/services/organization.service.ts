import { Autowired, Service } from "fragment-ts";
import type { Response } from "fragment-ts";
import { SseWriter } from "../../../core/ai/sse/sse-writer";
import { OrganizationPlan } from "../../../entities/enums/organization-plan.enum";
import { InvitationStatus } from "../../../entities/enums/invitation-status.enum";
import { OrganizationRole } from "../../../entities/enums/organization-role.enum";
import { UserAccountRepository } from "../../auth/repositories/user-account.repository";
import { AcceptOrganizationInvitationDto } from "../dto/accept-organization-invitation.dto";
import { CreateOrganizationDto } from "../dto/create-organization.dto";
import { CreateOrganizationInvitationDto } from "../dto/create-organization-invitation.dto";
import { OrganizationRepository } from "../repositories/organization.repository";
import { OrganizationInvitationRepository } from "../repositories/organization-invitation.repository";
import { OrganizationMembershipRepository } from "../repositories/organization-membership.repository";

@Service()
export class OrganizationService {
  @Autowired()
  private organizationRepository!: OrganizationRepository;

  @Autowired()
  private invitationRepository!: OrganizationInvitationRepository;

  @Autowired()
  private membershipRepository!: OrganizationMembershipRepository;

  @Autowired()
  private userAccountRepository!: UserAccountRepository;

  async getUserOrganizations(userId: string) {
    return this.organizationRepository.findByUserId(userId);
  }

  async getOrganization(organizationId: string) {
    return this.organizationRepository.findById(organizationId);
  }

  async createOrganization(payload: CreateOrganizationDto) {
    let ownerUserId = payload.ownerUserId?.trim() || null;

    if (ownerUserId) {
      const existingOwner = await this.userAccountRepository.findById(ownerUserId);

      if (!existingOwner) {
        if (!payload.ownerEmail?.trim()) {
          throw new Error(
            "Organization owner account was not found. Provide owner identity details before creating an organization.",
          );
        }

        const createdOwner = await this.userAccountRepository.save({
          id: ownerUserId,
          email: payload.ownerEmail.trim().toLowerCase(),
          firstName: payload.ownerFirstName?.trim() || null,
          lastName: payload.ownerLastName?.trim() || null,
          displayName: payload.ownerDisplayName?.trim() || null,
        });

        ownerUserId = createdOwner.id;
      }
    } else if (payload.ownerEmail?.trim()) {
      const existingOwner = await this.userAccountRepository.findByEmail(
        payload.ownerEmail,
      );

      if (existingOwner) {
        ownerUserId = existingOwner.id;
      }
    }

    const organization = await this.organizationRepository.save({
      name: payload.name.trim(),
      slug: this.slugify(payload.slug ?? payload.name),
      sizeLabel:
        payload.sizeLabel?.trim() ||
        (payload.size !== undefined && payload.size !== null
          ? String(payload.size).trim()
          : "") ||
        "1",
      isEnabled: payload.isEnabled ?? payload.enabled ?? false,
      enabledMessage: payload.enabledMessage ?? null,
      plan: payload.plan ?? OrganizationPlan.FREE,
    });

    if (ownerUserId) {
      const membership = await this.membershipRepository.findByUserAndOrganization(
        ownerUserId,
        organization.id,
      );

      if (!membership) {
        await this.membershipRepository.save({
          userId: ownerUserId,
          organizationId: organization.id,
          role: OrganizationRole.OWNER,
        });
      }
    }

    return this.organizationRepository.findById(organization.id);
  }

  async getOrganizationMembers(organizationId: string) {
    return this.membershipRepository.findByOrganizationId(organizationId);
  }

  async getOrganizationInvitations(organizationId: string) {
    return this.invitationRepository.findByOrganizationId(organizationId);
  }

  async updateOrganization(
    organizationId: string,
    payload: Partial<CreateOrganizationDto>,
  ) {
    const organization = await this.requireOrganization(organizationId);
    const slug =
      payload.slug && payload.slug !== organization.slug
        ? this.slugify(payload.slug)
        : organization.slug;

    return this.organizationRepository.save({
      ...organization,
      name: payload.name?.trim() ?? organization.name,
      slug,
      sizeLabel:
        payload.sizeLabel?.trim() ||
        (payload.size !== undefined && payload.size !== null
          ? String(payload.size).trim()
          : "") ||
        organization.sizeLabel,
      isEnabled: payload.isEnabled ?? payload.enabled ?? organization.isEnabled,
      enabledMessage:
        payload.enabledMessage === undefined
          ? organization.enabledMessage
          : payload.enabledMessage,
      plan: payload.plan ?? organization.plan,
    });
  }

  async deleteOrganization(organizationId: string) {
    await this.requireOrganization(organizationId);
    await this.organizationRepository.deleteById(organizationId);
    return { id: organizationId, deleted: true };
  }

  async createOrganizationInvitation(
    organizationId: string,
    payload: CreateOrganizationInvitationDto,
  ) {
    const organization = await this.organizationRepository.findById(organizationId);

    if (!organization) {
      throw new Error(`Organization ${organizationId} not found.`);
    }

    return this.invitationRepository.save({
      organizationId,
      inviteeEmail: payload.inviteeEmail.trim().toLowerCase(),
      inviterUserId: payload.inviterUserId ?? null,
      role: payload.role ?? OrganizationRole.MEMBER,
      status: InvitationStatus.PENDING,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
    });
  }

  async getInvitationsByEmail(email: string) {
    return this.invitationRepository.findByEmail(email.trim().toLowerCase());
  }

  async revokeInvitation(invitationId: string) {
    const invitation = await this.invitationRepository.findById(invitationId);
    if (!invitation) {
      throw new Error(`Invitation ${invitationId} not found.`);
    }

    await this.invitationRepository.deleteById(invitationId);
    return { id: invitationId, deleted: true };
  }

  async verifyInvitation(invitationId: string, email: string) {
    const invitation = await this.invitationRepository.findById(invitationId);
    if (!invitation) {
      throw new Error(`Invitation ${invitationId} not found.`);
    }

    return {
      valid: invitation.inviteeEmail.trim().toLowerCase() === email.trim().toLowerCase(),
      invitation,
    };
  }

  async addUserToOrganization(
    organizationId: string,
    userId: string,
    role: OrganizationRole = OrganizationRole.MEMBER,
  ) {
    await this.requireOrganization(organizationId);
    const existing = await this.membershipRepository.findByUserAndOrganization(
      userId,
      organizationId,
    );

    if (existing) {
      return existing;
    }

    return this.membershipRepository.save({
      userId,
      organizationId,
      role,
    });
  }

  async getMembership(organizationId: string, userId: string) {
    return this.membershipRepository.findMembership(userId, organizationId);
  }

  async removeUserFromOrganization(organizationId: string, userId: string) {
    await this.membershipRepository.deleteByUserAndOrganization(userId, organizationId);
    return { organizationId, userId, deleted: true };
  }

  async updateUserRole(organizationId: string, userId: string, role: OrganizationRole) {
    const membership = await this.membershipRepository.findMembership(userId, organizationId);
    if (!membership) {
      throw new Error(`Membership not found for user ${userId}.`);
    }

    return this.membershipRepository.save({
      ...membership,
      role,
    });
  }

  async transferOwnership(
    organizationId: string,
    targetUserId: string,
    previousOwnerUserId?: string,
  ) {
    const currentOwner =
      previousOwnerUserId
        ? await this.membershipRepository.findMembership(previousOwnerUserId, organizationId)
        : null;

    if (currentOwner) {
      await this.membershipRepository.save({
        ...currentOwner,
        role: OrganizationRole.ADMIN,
      });
    }

    const targetMembership =
      (await this.membershipRepository.findMembership(targetUserId, organizationId)) ??
      (await this.membershipRepository.save({
        userId: targetUserId,
        organizationId,
        role: OrganizationRole.OWNER,
      }));

    return this.membershipRepository.save({
      ...targetMembership,
      role: OrganizationRole.OWNER,
    });
  }

  async setLastAccessedOrganization(userId: string, organizationId: string) {
    const user = await this.userAccountRepository.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found.`);
    }

    return this.userAccountRepository.save({
      ...user,
      lastAccessedOrganizationId: organizationId,
    });
  }

  async acceptInvitationWithSse(
    invitationId: string,
    payload: AcceptOrganizationInvitationDto,
    response: Response,
  ): Promise<void> {
    const sse = new SseWriter(response);
    sse.initialize();

    try {
      const invitation = await this.invitationRepository.findById(invitationId);

      if (!invitation) {
        throw new Error(`Invitation ${invitationId} not found.`);
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new Error(`Invitation ${invitationId} is no longer pending.`);
      }

      if (invitation.inviteeEmail.trim().toLowerCase() !== payload.email.trim().toLowerCase()) {
        throw new Error("Invitation email does not match onboarding email.");
      }

      const existingMembership =
        await this.membershipRepository.findByUserAndOrganization(
          payload.userId,
          invitation.organizationId,
        );

      const user =
        (await this.userAccountRepository.findById(payload.userId)) ??
        (await this.userAccountRepository.save({
          id: payload.userId,
          email: payload.email.trim().toLowerCase(),
          displayName: payload.displayName ?? null,
        }));

      if (!existingMembership) {
        await this.membershipRepository.save({
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        });
      }

      await this.invitationRepository.save({
        ...invitation,
        status: InvitationStatus.ACCEPTED,
      });

      sse.write({
        type: "start",
        data: {
          invitationId: invitation.id,
        },
      });

      sse.write({
        type: "delta",
        event: "organization.onboarding",
        data: {
          organization: {
            id: invitation.organization.id,
            name: invitation.organization.name,
            slug: invitation.organization.slug,
          },
          invitation: {
            id: invitation.id,
            role: invitation.role,
            status: InvitationStatus.ACCEPTED,
          },
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
          },
        },
      });

      sse.write({
        type: "finish",
        event: "organization.onboarding.completed",
        data: {
          invitationId: invitation.id,
          organizationId: invitation.organization.id,
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
              : "Failed to accept organization invitation.",
        },
      });
      sse.done();
    }
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `organization-${Date.now()}`;
  }

  private async requireOrganization(organizationId: string) {
    const organization = await this.organizationRepository.findById(organizationId);
    if (!organization) {
      throw new Error(`Organization ${organizationId} not found.`);
    }

    return organization;
  }
}
