import { Autowired, Service } from "fragment-ts";
import { AssetRepository } from "../repositories/asset.repository";
import { ExternalResourceRepository } from "../repositories/external-resource.repository";

@Service()
export class AssetsAndResourcesQueryService {
  @Autowired()
  private assetRepository!: AssetRepository;

  @Autowired()
  private externalResourceRepository!: ExternalResourceRepository;

  async getAgentAssets(agentId: string) {
    return this.assetRepository.findByAgentId(agentId);
  }

  async getAgentResources(agentId: string) {
    return this.externalResourceRepository.findByAgentId(agentId);
  }

  async getAssetById(assetId: string) {
    return this.assetRepository.findById(assetId);
  }

  async getResourceById(resourceId: string) {
    return this.externalResourceRepository.findById(resourceId);
  }
}
