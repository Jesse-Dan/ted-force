import { generateText } from "ai";
import { Autowired, Service } from "fragment-ts";
import { LanguageModelResolverService } from "../../../core/ai/services/language-model-resolver.service";
import { AgentRuntimeRepository } from "../repositories/agent-runtime.repository";

@Service()
export class AgentConversationService {
  @Autowired()
  private runtimeRepository!: AgentRuntimeRepository;

  @Autowired()
  private languageModelResolver!: LanguageModelResolverService;

  async getConversations(agentId: string, sessionId: string) {
    return this.runtimeRepository.findConversationsByAgentIdAndSessionId(agentId, sessionId);
  }

  async getMessages(agentId: string, conversationId: string) {
    return this.runtimeRepository.findMessagesByAgentIdAndConversationId(agentId, conversationId);
  }

  async deleteConversation(agentId: string, conversationId: string) {
    const conversation = await this.runtimeRepository.findConversation(agentId, conversationId);
    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    return this.runtimeRepository.deleteConversation(conversationId);
  }

  async renameConversation(agentId: string, conversationId: string, title: string) {
    const conversation = await this.runtimeRepository.findConversation(agentId, conversationId);
    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      throw new Error("Conversation title is required.");
    }

    return this.runtimeRepository.saveConversation({
      id: conversation.id,
      title: normalizedTitle,
    });
  }

  async generateConversationTitle(agentId: string, conversationId: string) {
    const conversation = await this.runtimeRepository.findConversation(agentId, conversationId);
    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const existingTitle = conversation.title?.trim();
    if (existingTitle && existingTitle !== "New Conversation") {
      return conversation;
    }

    const messages = await this.runtimeRepository.findMessagesByAgentIdAndConversationId(
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
      const agentConfig = await this.runtimeRepository.findAgentConfig(agentId);
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

        const aiTitle = result.text.trim().replace(/^['"]|['"]$/g, "");
        if (aiTitle) {
          nextTitle = aiTitle;
        }
      }
    } catch {
      // Fallback title is already computed.
    }

    return this.runtimeRepository.saveConversation({
      id: conversation.id,
      title: nextTitle,
    });
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
