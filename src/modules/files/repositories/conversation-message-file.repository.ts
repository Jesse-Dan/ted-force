import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { AgentConversationMessage } from "../../../entities/agent-conversation-message.entity";
import { ConversationMessageFile } from "../../../entities/conversation-message-file.entity";

@FragmentRepository()
export class ConversationMessageFileRepository {
  @InjectRepository(ConversationMessageFile)
  private conversationMessageFileRepository!: Repository<ConversationMessageFile>;

  @InjectRepository(AgentConversationMessage)
  private conversationMessageRepository!: Repository<AgentConversationMessage>;

  async findConversationMessageById(
    conversationMessageId: string,
  ): Promise<AgentConversationMessage | null> {
    return this.conversationMessageRepository.findOne({
      where: { id: conversationMessageId },
    });
  }

  async save(
    attachment: Partial<ConversationMessageFile>,
  ): Promise<ConversationMessageFile> {
    return this.conversationMessageFileRepository.save(attachment);
  }
}
