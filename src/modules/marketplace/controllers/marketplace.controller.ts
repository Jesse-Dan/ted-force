import { Autowired, Body, Controller, Get, Param, Res, Response, Post } from "fragment-ts";
import { AgentRuntimeRequestDto } from "../../agent/dto/agent-runtime-request.dto";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { MarketplaceService } from "../services/marketplace.service";

@UseRequestContextPipeline()
@Controller("/marketplace")
export class MarketplaceController {
  @Autowired()
  private marketplaceService!: MarketplaceService;

  @Get("/agents")
  async getAgents() {
    return this.marketplaceService.getAgents();
  }

  @Get("/agents/:slug")
  async getAgentBySlug(@Param("slug") slug: string) {
    return this.marketplaceService.getAgentBySlug(slug);
  }

  @Post("/agents/:agentId/prompt")
  async prompt(
    @Param("agentId") agentId: string,
    @Body() body: AgentRuntimeRequestDto,
    @Res() response: Response,
  ) {
    return this.marketplaceService.prompt(agentId, body, response);
  }
}
