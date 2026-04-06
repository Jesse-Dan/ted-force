import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { Asset } from "../../../entities/asset.entity";

@FragmentRepository()
export class AssetRepository {
  @InjectRepository(Asset)
  private assetRepository!: Repository<Asset>;

  async findByAgentId(agentId: string): Promise<Asset[]> {
    return this.assetRepository.find({
      where: { agentId },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async save(input: Partial<Asset>): Promise<Asset> {
    return this.assetRepository.save(input);
  }

  async findById(id: string): Promise<Asset | null> {
    return this.assetRepository.findOne({
      where: { id },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.assetRepository.delete(id);
  }
}
