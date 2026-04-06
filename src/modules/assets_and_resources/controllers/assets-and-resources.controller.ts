import { Autowired, Body, Controller, Delete, Get, Param, Post } from "fragment-ts";
import { UseAgentManagementPipeline } from "../../../common/decorators/use-agent-management-pipeline.decorator";
import { CreateAssetDto } from "../dto/create-asset.dto";
import { CreateExternalResourceDto } from "../dto/create-external-resource.dto";
import { AssetsAndResourcesCommandService } from "../services/assets-and-resources-command.service";
import { AssetsAndResourcesQueryService } from "../services/assets-and-resources-query.service";

@UseAgentManagementPipeline()
@Controller("/assets-and-resources")
export class AssetsAndResourcesController {
  @Autowired()
  private assetsAndResourcesQueryService!: AssetsAndResourcesQueryService;

  @Autowired()
  private assetsAndResourcesCommandService!: AssetsAndResourcesCommandService;

  @Get("/assets/:agentId")
  async getAssets(@Param("agentId") agentId: string) {
    return this.assetsAndResourcesQueryService.getAgentAssets(agentId);
  }

  @Get("/resources/:agentId")
  async getResources(@Param("agentId") agentId: string) {
    return this.assetsAndResourcesQueryService.getAgentResources(agentId);
  }

  @Get("/asset/:assetId")
  async getAssetById(@Param("assetId") assetId: string) {
    return this.assetsAndResourcesQueryService.getAssetById(assetId);
  }

  @Get("/resource/:resourceId")
  async getResourceById(@Param("resourceId") resourceId: string) {
    return this.assetsAndResourcesQueryService.getResourceById(resourceId);
  }

  @Post("/assets/:agentId")
  async createAsset(
    @Param("agentId") agentId: string,
    @Body() body: CreateAssetDto,
  ) {
    return this.assetsAndResourcesCommandService.createAsset(agentId, body);
  }

  @Post("/resources/:agentId")
  async createResource(
    @Param("agentId") agentId: string,
    @Body() body: CreateExternalResourceDto,
  ) {
    return this.assetsAndResourcesCommandService.createResource(agentId, body);
  }

  @Delete("/assets/:assetId")
  async deleteAsset(@Param("assetId") assetId: string) {
    return this.assetsAndResourcesCommandService.deleteAsset(assetId);
  }

  @Delete("/resources/:resourceId")
  async deleteResource(@Param("resourceId") resourceId: string) {
    return this.assetsAndResourcesCommandService.deleteResource(resourceId);
  }
}
