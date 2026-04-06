import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { OrganizationMembership } from "../../../entities/organization-membership.entity";

@FragmentRepository()
export class OrganizationMembershipRepository {
  @InjectRepository(OrganizationMembership)
  private membershipRepository!: Repository<OrganizationMembership>;

  async findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationMembership[]> {
    return this.membershipRepository.find({
      where: {
        organizationId,
      },
      relations: {
        user: true,
        organization: true,
      },
      order: {
        createdAt: "ASC",
      },
    });
  }

  async findByUserAndOrganization(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembership | null> {
    return this.membershipRepository.findOne({
      where: {
        userId,
        organizationId,
      },
    });
  }

  async save(
    membership: Partial<OrganizationMembership>,
  ): Promise<OrganizationMembership> {
    return this.membershipRepository.save(membership);
  }

  async findById(id: string) {
    return this.membershipRepository.findOne({
      where: { id },
      relations: {
        user: true,
        organization: true,
      },
    });
  }

  async findMembership(userId: string, organizationId: string) {
    return this.membershipRepository.findOne({
      where: { userId, organizationId },
      relations: {
        user: true,
        organization: true,
      },
    });
  }

  async deleteByUserAndOrganization(userId: string, organizationId: string) {
    await this.membershipRepository.delete({ userId, organizationId });
  }
}
