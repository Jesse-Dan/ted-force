import {
  Autowired,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Response,
} from "fragment-ts";
import { UseAgentManagementPipeline } from "../../../common/decorators/use-agent-management-pipeline.decorator";
import { SdkManagementService } from "../../sdk/services/sdk-management.service";
import { AgentRuntimeRequestDto } from "../dto/agent-runtime-request.dto";
import { CreateAgentDto } from "../dto/create-agent.dto";
import { UpdateAgentStatusDto } from "../dto/update-agent-status.dto";
import { UpdateAgentDto } from "../dto/update-agent.dto";
import { AgentConversationService } from "../services/agent-conversation.service";
import { AgentRuntimeService } from "../services/agent-runtime.service";
import { AgentService } from "../services/agent.service";

@UseAgentManagementPipeline()
@Controller("/agents")
export class AgentController {
  @Autowired()
  private agentRuntimeService!: AgentRuntimeService;

  @Autowired()
  private agentService!: AgentService;

  @Autowired()
  private agentConversationService!: AgentConversationService;

  @Autowired()
  private sdkManagementService!: SdkManagementService;

  @Get()
  async listAgents(
    @Query("organizationId") organizationId?: string,
    @Query("ownerUserId") ownerUserId?: string,
  ) {
    return this.agentService.listAgents({ organizationId, ownerUserId });
  }

  @Get("/:agentId")
  async getAgent(@Param("agentId") agentId: string) {
    return this.agentService.getAgentById(agentId);
  }

  @Post()
  async createAgent(@Body() body: CreateAgentDto) {
    return this.agentService.createAgent(body);
  }

  @Post("/duplicate")
  async duplicateAgent(@Body() body: { agentId: string; name?: string }) {
    return this.agentService.duplicateAgent(body.agentId, body.name);
  }

  @Patch("/:agentId")
  async updateAgent(
    @Param("agentId") agentId: string,
    @Body() body: UpdateAgentDto,
  ) {
    return this.agentService.updateAgent(agentId, body);
  }

  @Patch("/:agentId/status")
  async updateStatus(
    @Param("agentId") agentId: string,
    @Body() body: UpdateAgentStatusDto,
  ) {
    return this.agentService.updateAgentStatus(
      agentId,
      body.status,
      body.blockReason,
    );
  }

  @Delete("/:agentId")
  async deleteAgent(@Param("agentId") agentId: string) {
    return this.agentService.deleteAgent(agentId);
  }

  @Post("/:agentId/runtime")
  async respondWithSse(
    @Param("agentId") agentId: string,
    @Body() body: AgentRuntimeRequestDto,
    @Res() response: Response,
  ) {
    await this.agentRuntimeService.respondWithSse(agentId, body, response);
    return response;
  }

  @Get("/:agentId/runtime/conversations/:sessionId")
  async getConversations(
    @Param("agentId") agentId: string,
    @Param("sessionId") sessionId: string,
  ) {
    return this.agentConversationService.getConversations(agentId, sessionId);
  }

  @Get("/:agentId/runtime/messages/:conversationId")
  async getMessages(
    @Param("agentId") agentId: string,
    @Param("conversationId") conversationId: string,
  ) {
    return this.agentConversationService.getMessages(agentId, conversationId);
  }

  @Delete("/:agentId/runtime/conversations/:conversationId")
  async deleteConversation(
    @Param("agentId") agentId: string,
    @Param("conversationId") conversationId: string,
  ) {
    return this.agentConversationService.deleteConversation(
      agentId,
      conversationId,
    );
  }

  @Patch("/:agentId/runtime/conversations/:conversationId")
  async renameConversation(
    @Param("agentId") agentId: string,
    @Param("conversationId") conversationId: string,
    @Body() body: { title: string },
  ) {
    return this.agentConversationService.renameConversation(
      agentId,
      conversationId,
      body.title,
    );
  }

  @Post("/:agentId/runtime/conversations/:conversationId/title")
  async generateConversationTitle(
    @Param("agentId") agentId: string,
    @Param("conversationId") conversationId: string,
  ) {
    return this.agentConversationService.generateConversationTitle(
      agentId,
      conversationId,
    );
  }

  @Get("/:agentId/endpoints")
  getAgentEndpoints(@Param("agentId") agentId: string) {
    return this.sdkManagementService.getPublicEndpointCatalog(agentId);
  }
}
