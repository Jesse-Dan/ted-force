import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { ExternalResource } from "../../../entities/external-resource.entity";

@FragmentRepository()
export class ExternalResourceRepository {
  @InjectRepository(ExternalResource)
  private resourceRepository!: Repository<ExternalResource>;

  async findByAgentId(agentId: string): Promise<ExternalResource[]> {
    return this.resourceRepository.find({
      where: { agentId },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async save(input: Partial<ExternalResource>): Promise<ExternalResource> {
    return this.resourceRepository.save(input);
  }

  async findById(id: string): Promise<ExternalResource | null> {
    return this.resourceRepository.findOne({
      where: { id },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.resourceRepository.delete(id);
  }
}
