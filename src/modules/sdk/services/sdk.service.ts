import { generateText } from "ai";
import { Autowired, Service } from "fragment-ts";
import type { Response } from "fragment-ts";
import { AgentClientAccessService } from "../../../common/services/agent-client-access.service";
import { LanguageModelResolverService } from "../../../core/ai/services/language-model-resolver.service";
import { AgentRuntimeService } from "../../agent/services/agent-runtime.service";
import { SdkPromptDto } from "../dto/sdk-prompt.dto";
import { SdkRepository } from "../repositories/sdk.repository";

@Service()
export class SdkService {
  @Autowired()
  private sdkRepository!: SdkRepository;

  @Autowired()
  private agentRuntimeService!: AgentRuntimeService;

  @Autowired()
  private languageModelResolver!: LanguageModelResolverService;

  @Autowired()
  private agentClientAccessService!: AgentClientAccessService;

  async prompt(agentId: string, payload: SdkPromptDto, response: Response) {
    await this.agentClientAccessService.assertAgentAccess(agentId);

    if (payload.stream === false) {
      return this.agentRuntimeService.respond(agentId, payload);
    }

    await this.agentRuntimeService.respondWithSse(agentId, payload, response);
    return response;
  }

  async getConversations(agentId: string, sessionId: string) {
    await this.agentClientAccessService.assertAgentAccess(agentId);
    return this.sdkRepository.findConversationsByAgentIdAndSessionId(agentId, sessionId);
  }

  async deleteConversation(agentId: string, conversationId: string) {
    await this.agentClientAccessService.assertAgentAccess(agentId);

    const conversation = await this.sdkRepository.findConversationByAgentIdAndId(
      agentId,
      conversationId,
    );

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    return this.sdkRepository.deleteConversation(conversationId);
  }

  async renameConversation(agentId: string, conversationId: string, title: string) {
    await this.agentClientAccessService.assertAgentAccess(agentId);
    const conversation = await this.sdkRepository.findConversationByAgentIdAndId(
      agentId,
      conversationId,
    );

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      throw new Error("Conversation title is required.");
    }

    return this.sdkRepository.saveConversation({
      id: conversation.id,
      title: normalizedTitle,
    });
  }

  async generateConversationTitle(agentId: string, conversationId: string) {
    await this.agentClientAccessService.assertAgentAccess(agentId);
    const conversation = await this.sdkRepository.findConversationByAgentIdAndId(
      agentId,
      conversationId,
    );

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const existingTitle = conversation.title?.trim();
    if (existingTitle && existingTitle !== "New Conversation") {
      return conversation;
    }

    const messages = await this.sdkRepository.findMessagesByAgentIdAndConversationId(
      agentId,
      conversationId,
    );
    const firstUserMessage = messages.find((message) => message.role === "user");
    const promptText = firstUserMessage?.text?.trim();

    if (!promptText) {
      return conversation;
    }

    let nextTitle = this.buildFallbackTitle(promptText);

    try {
      const agentConfig = conversation.agentId
        ? await this.agentRuntimeService["runtimeRepository"].findAgentConfig(conversation.agentId)
        : null;

      if (agentConfig) {
        const model = this.languageModelResolver.resolve(agentConfig);
        const result = await generateText({
          model,
          system:
            "Generate a concise conversation title from the first user message. Return only the title, no quotes, max 6 words.",
          prompt: promptText,
          temperature: 0.2,
          maxOutputTokens: 24,
        });

        const aiTitle = result.text.trim().replace(/^["']|["']$/g, "");
        if (aiTitle) {
          nextTitle = aiTitle;
        }
      }
    } catch {
      // Fallback title is already computed, so title generation stays seamless even if the model path fails.
    }

    return this.sdkRepository.saveConversation({
      id: conversation.id,
      title: nextTitle,
    });
  }

  async getMessages(agentId: string, conversationId: string) {
    await this.agentClientAccessService.assertAgentAccess(agentId);
    return this.sdkRepository.findMessagesByAgentIdAndConversationId(
      agentId,
      conversationId,
    );
  }

  async getMessagesByRun(agentId: string, runId: string) {
    await this.agentClientAccessService.assertAgentAccess(agentId);
    return this.sdkRepository.findMessagesByAgentIdAndRunId(agentId, runId);
  }

  async getResources(agentId: string, sessionId: string) {
    await this.agentClientAccessService.assertAgentAccess(agentId);
    return this.sdkRepository.findResourcesByAgentIdAndSessionId(agentId, sessionId);
  }

  private buildFallbackTitle(input: string) {
    const cleaned = input.replace(/\s+/g, " ").trim();
    if (!cleaned) {
      return "New Conversation";
    }

    const withoutRuntimePrefix = cleaned.replace(/^\[runtime:[^\]]+\]\s*/i, "");
    const words = withoutRuntimePrefix.split(" ").filter(Boolean).slice(0, 6);
    const title = words.join(" ").trim();
    return title.length > 60 ? `${title.slice(0, 57).trimEnd()}...` : title || "New Conversation";
  }
}
