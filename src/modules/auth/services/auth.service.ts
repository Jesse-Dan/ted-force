import { Autowired, Service } from "fragment-ts";
import { OrganizationMembershipRepository } from "../../organization/repositories/organization-membership.repository";
import { UpsertUserAccountDto } from "../dto/upsert-user-account.dto";
import { UserAccountRepository } from "../repositories/user-account.repository";

@Service()
export class AuthService {
  @Autowired()
  private userAccountRepository!: UserAccountRepository;

  @Autowired()
  private membershipRepository!: OrganizationMembershipRepository;

  async getUserById(userId: string) {
    return this.userAccountRepository.findById(userId);
  }

  async listUsers() {
    return this.userAccountRepository.listAll();
  }

  async getUserByEmail(email: string) {
    return this.userAccountRepository.findByEmail(email);
  }

  async upsertUser(payload: UpsertUserAccountDto) {
    const existing = await this.userAccountRepository.findById(payload.id);

    return this.userAccountRepository.save({
      ...existing,
      id: payload.id,
      email: payload.email.trim().toLowerCase(),
      firstName:
        payload.firstName === undefined
          ? existing?.firstName
          : payload.firstName?.trim() ?? null,
      lastName:
        payload.lastName === undefined
          ? existing?.lastName
          : payload.lastName?.trim() ?? null,
      displayName:
        payload.displayName === undefined
          ? existing?.displayName
          : payload.displayName?.trim() ?? null,
      lastAccessedOrganizationId:
        payload.lastAccessedOrganizationId === undefined
          ? existing?.lastAccessedOrganizationId
          : payload.lastAccessedOrganizationId,
      isPlatformAdmin:
        payload.isPlatformAdmin === undefined
          ? existing?.isPlatformAdmin ?? false
          : payload.isPlatformAdmin,
    });
  }

  async getRole(userId: string, organizationId: string) {
    const user = userId
      ? await this.userAccountRepository.findById(userId)
      : null;
    const platformAdmin = Boolean(user?.isPlatformAdmin);

    if (!userId || !organizationId) {
      return {
        app_id: "tuul",
        app_name: "tuul",
        role: "member",
        status: "active",
        platformAdmin,
        organizationId: organizationId || null,
        membership: null,
        permissions: {
          canTransferOwnership: false,
          canManageMembers: false,
          canManageBilling: false,
          canManageOrganizationSettings: false,
          canCreateAgents: false,
        },
      };
    }

    const membership = await this.membershipRepository.findMembership(
      userId,
      organizationId,
    );

    const normalizedRole =
      membership?.role === "owner" || membership?.role === "admin"
        ? membership.role
        : "member";

    const canManageMembers =
      normalizedRole === "owner" || normalizedRole === "admin";
    const canTransferOwnership = normalizedRole === "owner";
    const canManageBilling = normalizedRole === "owner" || normalizedRole === "admin";
    const canManageOrganizationSettings =
      normalizedRole === "owner" || normalizedRole === "admin";
    const canCreateAgents =
      normalizedRole === "owner" || normalizedRole === "admin" || normalizedRole === "member";

    return {
      app_id: "tuul",
      app_name: "tuul",
      role: normalizedRole,
      status: membership ? "active" : "inactive",
      platformAdmin,
      organizationId,
      membership,
      permissions: {
        canTransferOwnership,
        canManageMembers,
        canManageBilling,
        canManageOrganizationSettings,
        canCreateAgents,
      },
    };
  }
}
