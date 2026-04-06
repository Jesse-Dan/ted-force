import {
  Autowired,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from "fragment-ts";
import { UseAgentManagementPipeline } from "../../../common/decorators/use-agent-management-pipeline.decorator";
import { CreateAgentToolDto } from "../dto/create-agent-tool.dto";
import { TestAgentToolDto } from "../dto/test-agent-tool.dto";
import { UpdateAgentToolDto } from "../dto/update-agent-tool.dto";
import { ToolsService } from "../services/tools.service";

@UseAgentManagementPipeline()
@Controller("/tools")
export class ToolsController {
  @Autowired()
  private toolsService!: ToolsService;

  @Get("/platform")
  async listPlatformTools() {
    return this.toolsService.listPlatformTools();
  }

  @Get("/agents/:agentId")
  async listAgentTools(@Param("agentId") agentId: string) {
    return this.toolsService.listAgentTools(agentId);
  }

  @Post("/agents/:agentId")
  async createAgentTool(
    @Param("agentId") agentId: string,
    @Body() body: CreateAgentToolDto,
  ) {
    return this.toolsService.createAgentTool(agentId, body);
  }

  @Delete("/agents/:agentToolId")
  async deleteAgentTool(@Param("agentToolId") agentToolId: string) {
    return this.toolsService.deleteAgentTool(agentToolId);
  }

  @Put("/agents/:agentToolId")
  async updateAgentTool(
    @Param("agentToolId") agentToolId: string,
    @Body() body: UpdateAgentToolDto,
  ) {
    return this.toolsService.updateAgentTool(agentToolId, body);
  }

  @Post("/test")
  async runTest(@Body() body: TestAgentToolDto) {
    return this.toolsService.runTest(body);
  }

  @Get("/keywords")
  async getKeywords() {
    return this.toolsService.getKeywords();
  }

  @Get("/memory/:sharedMemoryId")
  async getMemory(@Param("sharedMemoryId") sharedMemoryId: string) {
    return this.toolsService.getMemoryById(sharedMemoryId);
  }

  @Post("/memory/:sharedMemoryId/update")
  async updateMemory(
    @Param("sharedMemoryId") sharedMemoryId: string,
    @Body() body: { data: Record<string, unknown> },
  ) {
    return this.toolsService.updateMemory(sharedMemoryId, body.data ?? {});
  }

  @Post("/memory/:sharedMemoryId/clear")
  async clearMemory(@Param("sharedMemoryId") sharedMemoryId: string) {
    return this.toolsService.clearMemory(sharedMemoryId);
  }
}
