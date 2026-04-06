import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { OrganizationRepositoryConnection } from "../../../entities/organization-repository-connection.entity";

@FragmentRepository()
export class OrganizationRepositoryConnectionRepository {
  @InjectRepository(OrganizationRepositoryConnection)
  private repository!: Repository<OrganizationRepositoryConnection>;

  async findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationRepositoryConnection | null> {
    return this.repository.findOne({
      where: { organizationId },
      relations: {
        organization: true,
      },
    });
  }

  async save(
    input: Partial<OrganizationRepositoryConnection>,
  ): Promise<OrganizationRepositoryConnection> {
    return this.repository.save(input);
  }
}
