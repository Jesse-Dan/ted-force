import {
  Autowired,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Response,
  Res,
} from "fragment-ts";
import { UseAgentRequestPipeline } from "../../../common/decorators/use-agent-request-pipeline.decorator";
import { SdkPromptDto } from "../dto/sdk-prompt.dto";
import { UpdateConversationTitleDto } from "../dto/update-conversation-title.dto";
import { SdkService } from "../services/sdk.service";

@UseAgentRequestPipeline()
@Controller("/sdk")
export class SdkController {
  @Autowired()
  private sdkService!: SdkService;

  @Post("/agents/:agentId/prompt")
  async prompt(
    @Param("agentId") agentId: string,
    @Body() body: SdkPromptDto,
    @Res() response: Response,
  ) {
    return this.sdkService.prompt(agentId, body, response);
  }

  @Get("/agents/:agentId/conversations/:sessionId")
  async getConversations(
    @Param("agentId") agentId: string,
    @Param("sessionId") sessionId: string,
  ) {
    return this.sdkService.getConversations(agentId, sessionId);
  }

  @Delete("/agents/:agentId/conversations/:conversationId")
  async deleteConversation(
    @Param("agentId") agentId: string,
    @Param("conversationId") conversationId: string,
  ) {
    return this.sdkService.deleteConversation(agentId, conversationId);
  }

  @Patch("/agents/:agentId/conversations/:conversationId")
  async renameConversation(
    @Param("agentId") agentId: string,
    @Param("conversationId") conversationId: string,
    @Body() body: UpdateConversationTitleDto,
  ) {
    return this.sdkService.renameConversation(agentId, conversationId, body.title);
  }

  @Post("/agents/:agentId/conversations/:conversationId/title")
  async generateConversationTitle(
    @Param("agentId") agentId: string,
    @Param("conversationId") conversationId: string,
  ) {
    return this.sdkService.generateConversationTitle(agentId, conversationId);
  }

  @Get("/agents/:agentId/messages/:conversationId")
  async getMessages(
    @Param("agentId") agentId: string,
    @Param("conversationId") conversationId: string,
  ) {
    return this.sdkService.getMessages(agentId, conversationId);
  }

  @Get("/agents/:agentId/messages/run/:runId")
  async getMessagesByRun(
    @Param("agentId") agentId: string,
    @Param("runId") runId: string,
  ) {
    return this.sdkService.getMessagesByRun(agentId, runId);
  }

  @Get("/agents/:agentId/resources/:sessionId")
  async getResources(
    @Param("agentId") agentId: string,
    @Param("sessionId") sessionId: string,
  ) {
    return this.sdkService.getResources(agentId, sessionId);
  }
}
