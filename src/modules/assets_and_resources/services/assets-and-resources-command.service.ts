import { Autowired, Service } from "fragment-ts";
import { AssetType } from "../../../entities/asset.entity";
import { ExternalResourceCategory } from "../../../entities/enums/external-resource-category.enum";
import { AgentRepository } from "../../agent/repositories/agent.repository";
import { CreateAssetDto } from "../dto/create-asset.dto";
import { CreateExternalResourceDto } from "../dto/create-external-resource.dto";
import { AssetRepository } from "../repositories/asset.repository";
import { ExternalResourceRepository } from "../repositories/external-resource.repository";

@Service()
export class AssetsAndResourcesCommandService {
  @Autowired()
  private agentRepository!: AgentRepository;

  @Autowired()
  private assetRepository!: AssetRepository;

  @Autowired()
  private externalResourceRepository!: ExternalResourceRepository;

  async createAsset(agentId: string, payload: CreateAssetDto) {
    await this.ensureAgent(agentId);

    return this.assetRepository.save({
      agentId,
      name: payload.name.trim(),
      type: payload.type ?? AssetType.OTHER,
      size: payload.size ?? 0,
      url: payload.url.trim(),
      tags: payload.tags?.map((tag) => tag.trim()).filter(Boolean),
    });
  }

  async createResource(agentId: string, payload: CreateExternalResourceDto) {
    await this.ensureAgent(agentId);

    return this.externalResourceRepository.save({
      agentId,
      name: payload.name.trim(),
      url: payload.url.trim(),
      description: payload.description.trim(),
      category: payload.category ?? ExternalResourceCategory.OTHER,
    });
  }

  async deleteAsset(assetId: string) {
    await this.assetRepository.deleteById(assetId);
    return { id: assetId, deleted: true };
  }

  async deleteResource(resourceId: string) {
    await this.externalResourceRepository.deleteById(resourceId);
    return { id: resourceId, deleted: true };
  }

  private async ensureAgent(agentId: string) {
    const agent = await this.agentRepository.findById(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }
  }
}
