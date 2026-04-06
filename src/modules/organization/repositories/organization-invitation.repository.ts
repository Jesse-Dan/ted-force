import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { OrganizationInvitation } from "../../../entities/organization-invitation.entity";

@FragmentRepository()
export class OrganizationInvitationRepository {
  @InjectRepository(OrganizationInvitation)
  private invitationRepository!: Repository<OrganizationInvitation>;

  async findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationInvitation[]> {
    return this.invitationRepository.find({
      where: { organizationId },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findById(invitationId: string): Promise<OrganizationInvitation | null> {
    return this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: {
        organization: true,
      },
    });
  }

  async save(
    invitation: Partial<OrganizationInvitation>,
  ): Promise<OrganizationInvitation> {
    return this.invitationRepository.save(invitation);
  }

  async findByEmail(email: string) {
    return this.invitationRepository.find({
      where: {
        inviteeEmail: email,
      },
      relations: {
        organization: true,
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async deleteById(invitationId: string) {
    await this.invitationRepository.delete(invitationId);
  }
}
