import { Autowired, Controller, Get, Param, Query } from "fragment-ts";
import { UseRequestContextPipeline } from "../../../common/decorators/use-request-context-pipeline.decorator";
import { McpService } from "../services/mcp.service";

@UseRequestContextPipeline()
@Controller("/mcp")
export class McpController {
  @Autowired()
  private mcpService!: McpService;

  @Get()
  listServers() {
    return this.mcpService.listServers();
  }

  @Get("/:slug")
  getServer(@Param("slug") slug: string) {
    return this.mcpService.getServer(slug);
  }

  @Get("/resolve/public-url")
  resolvePublicUrl(@Query("absolutePath") absolutePath: string) {
    return this.mcpService.resolvePublicUrl(absolutePath);
  }
}
