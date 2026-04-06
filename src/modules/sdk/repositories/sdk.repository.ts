import { FragmentRepository, InjectRepository, Repository } from "fragment-ts";
import { AgentConversationMessage } from "../../../entities/agent-conversation-message.entity";
import { AgentConversation } from "../../../entities/agent-conversation.entity";
import { StoredFile } from "../../../entities/stored-file.entity";

@FragmentRepository()
export class SdkRepository {
  @InjectRepository(AgentConversation)
  private conversationRepository!: Repository<AgentConversation>;

  @InjectRepository(AgentConversationMessage)
  private messageRepository!: Repository<AgentConversationMessage>;

  @InjectRepository(StoredFile)
  private storedFileRepository!: Repository<StoredFile>;

  async findConversationsBySessionId(sessionId: string) {
    return this.conversationRepository.find({
      where: { sessionId },
      relations: { agent: true },
      order: { createdAt: "DESC" },
    });
  }

  async findConversationsByAgentIdAndSessionId(agentId: string, sessionId: string) {
    return this.conversationRepository.find({
      where: { agentId, sessionId },
      relations: { agent: true },
      order: { createdAt: "DESC" },
    });
  }

  async deleteConversation(conversationId: string) {
    await this.messageRepository.delete({ conversationId });
    await this.conversationRepository.delete(conversationId);
    return { id: conversationId, deleted: true };
  }

  async findConversationById(conversationId: string) {
    return this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: { agent: true },
    });
  }

  async findConversationByAgentIdAndId(agentId: string, conversationId: string) {
    return this.conversationRepository.findOne({
      where: { id: conversationId, agentId },
      relations: { agent: true },
    });
  }

  async saveConversation(conversation: Partial<AgentConversation>) {
    return this.conversationRepository.save(conversation);
  }

  async findMessagesByConversationId(conversationId: string) {
    return this.messageRepository.find({
      where: { conversationId },
      order: { sequence: "ASC" },
    });
  }

  async findMessagesByAgentIdAndConversationId(agentId: string, conversationId: string) {
    return this.messageRepository.find({
      where: {
        conversationId,
        conversation: {
          agentId,
        },
      },
      relations: {
        conversation: true,
      },
      order: { sequence: "ASC" },
    });
  }

  async findMessagesByRunId(runId: string) {
    return this.messageRepository.find({
      where: { runId },
      order: { sequence: "ASC" },
    });
  }

  async findMessagesByAgentIdAndRunId(agentId: string, runId: string) {
    return this.messageRepository.find({
      where: {
        runId,
        conversation: {
          agentId,
        },
      },
      relations: {
        conversation: true,
      },
      order: { sequence: "ASC" },
    });
  }

  async findResourcesBySessionId(sessionId: string) {
    return this.storedFileRepository.find({
      where: { sessionId, isActive: true },
      order: { createdAt: "DESC" },
    });
  }

  async findResourcesByAgentIdAndSessionId(agentId: string, sessionId: string) {
    return this.storedFileRepository.find({
      where: { agentId, sessionId, isActive: true },
      order: { createdAt: "DESC" },
    });
  }
}
