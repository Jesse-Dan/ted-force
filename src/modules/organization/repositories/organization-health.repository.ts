import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { OrganizationHealth } from "../../../entities/organization-health.entity";

@FragmentRepository()
export class OrganizationHealthRepository {
  @InjectRepository(OrganizationHealth)
  private organizationHealthRepository!: Repository<OrganizationHealth>;

  async findByOrganizationId(organizationId: string): Promise<OrganizationHealth | null> {
    return this.organizationHealthRepository.findOne({
      where: { organizationId },
    });
  }

  async save(input: Partial<OrganizationHealth>): Promise<OrganizationHealth> {
    return this.organizationHealthRepository.save(input);
  }
}
