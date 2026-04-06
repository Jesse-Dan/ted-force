import { Autowired, Service } from "fragment-ts";
import { OrganizationRole } from "../../../entities/enums/organization-role.enum";
import { UpsertUserAccountDto } from "../../auth/dto/upsert-user-account.dto";
import { AuthService } from "../../auth/services/auth.service";
import { CreateOrganizationDto } from "../../organization/dto/create-organization.dto";
import { OrganizationMembershipRepository } from "../../organization/repositories/organization-membership.repository";
import { OrganizationService } from "../../organization/services/organization.service";
import { InitializeOnboardingDto } from "../dto/initialize-onboarding.dto";

@Service()
export class OnboardingService {
  @Autowired()
  private authService!: AuthService;

  @Autowired()
  private organizationService!: OrganizationService;

  @Autowired()
  private membershipRepository!: OrganizationMembershipRepository;

  async initialize(payload: InitializeOnboardingDto) {
    const user = await this.authService.upsertUser({
      id: payload.userId,
      email: payload.email,
      displayName: payload.displayName,
    } as UpsertUserAccountDto);

    let organization = null;

    if (payload.organizationName) {
      organization = await this.organizationService.createOrganization({
        name: payload.organizationName,
        slug: payload.organizationSlug,
        ownerUserId: payload.userId,
      } as CreateOrganizationDto);

      const membership = await this.membershipRepository.findByUserAndOrganization(
        payload.userId,
        organization!.id,
      );

      if (!membership) {
        await this.membershipRepository.save({
          userId: payload.userId,
          organizationId: organization!.id,
          role: OrganizationRole.OWNER,
        });
      }
    }

    return {
      user,
      organization,
      next: {
        shouldCreateAgent: Boolean(organization),
        shouldConfigureRuntime: true,
      },
    };
  }
}
