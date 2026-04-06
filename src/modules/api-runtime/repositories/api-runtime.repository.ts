import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { AgentConversationMessage } from "../../../entities/agent-conversation-message.entity";
import { AgentConversation } from "../../../entities/agent-conversation.entity";
import { RuntimeRun } from "../../../entities/runtime-run.entity";

@FragmentRepository()
export class ApiRuntimeRepository {
  @InjectRepository(RuntimeRun)
  private runtimeRunRepository!: Repository<RuntimeRun>;

  @InjectRepository(AgentConversation)
  private conversationRepository!: Repository<AgentConversation>;

  @InjectRepository(AgentConversationMessage)
  private conversationMessageRepository!: Repository<AgentConversationMessage>;

  async findLatestAgentRun(agentId: string): Promise<RuntimeRun | null> {
    return this.runtimeRunRepository.findOne({
      where: { agentId },
      order: {
        createdAt: "DESC",
      },
      relations: {
        messages: true,
      },
    });
  }

  async findConversationsBySessionId(sessionId: string) {
    return this.conversationRepository.find({
      where: { sessionId },
      relations: {
        agent: true,
        versions: true,
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findMessagesByConversationId(conversationId: string) {
    return this.conversationMessageRepository.find({
      where: { conversationId },
      order: {
        sequence: "ASC",
      },
    });
  }
}
