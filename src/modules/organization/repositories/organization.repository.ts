import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { Organization } from "../../../entities/organization.entity";

@FragmentRepository()
export class OrganizationRepository {
  @InjectRepository(Organization)
  private organizationRepository!: Repository<Organization>;

  async findByUserId(userId: string): Promise<Organization[]> {
    return this.organizationRepository
      .createQueryBuilder("organization")
      .leftJoinAndSelect("organization.profile", "profile")
      .leftJoinAndSelect("organization.healthRecord", "healthRecord")
      .leftJoinAndSelect("organization.memberships", "membership")
      .where("membership.userId = :userId", { userId })
      .orderBy("organization.updatedAt", "DESC")
      .getMany();
  }

  async findAllForBilling(): Promise<Organization[]> {
    return this.organizationRepository.find({
      relations: {
        profile: true,
        healthRecord: true,
        memberships: true,
        agents: true,
      },
      order: {
        updatedAt: "DESC",
      },
    });
  }

  async findById(organizationId: string): Promise<Organization | null> {
    return this.organizationRepository.findOne({
      where: { id: organizationId },
      relations: {
        profile: true,
        healthRecord: true,
        memberships: true,
      },
    });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.organizationRepository.findOne({
      where: { slug },
    });
  }

  async save(organization: Partial<Organization>): Promise<Organization> {
    return this.organizationRepository.save(organization);
  }

  async deleteById(organizationId: string): Promise<void> {
    await this.organizationRepository.delete(organizationId);
  }
}
