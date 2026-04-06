import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { AgentConversationMessage } from "../../../entities/agent-conversation-message.entity";
import { AgentConversationVersion } from "../../../entities/agent-conversation-version.entity";
import { AgentConversation } from "../../../entities/agent-conversation.entity";
import { ApiCallLog } from "../../../entities/api-call-log.entity";
import { ConversationMessageFile } from "../../../entities/conversation-message-file.entity";
import { RuntimeMessage } from "../../../entities/runtime-message.entity";
import { RuntimeRun } from "../../../entities/runtime-run.entity";
import { TokenUsageSession } from "../../../entities/token-usage-session.entity";
import { ActivityLog } from "../../../entities/activity-log.entity";

@FragmentRepository()
export class AgentRuntimePersistenceRepository {
  @InjectRepository(RuntimeRun)
  private runtimeRunRepository!: Repository<RuntimeRun>;

  @InjectRepository(RuntimeMessage)
  private runtimeMessageRepository!: Repository<RuntimeMessage>;

  @InjectRepository(TokenUsageSession)
  private tokenUsageSessionRepository!: Repository<TokenUsageSession>;

  @InjectRepository(ApiCallLog)
  private apiCallLogRepository!: Repository<ApiCallLog>;

  @InjectRepository(AgentConversation)
  private conversationRepository!: Repository<AgentConversation>;

  @InjectRepository(AgentConversationVersion)
  private conversationVersionRepository!: Repository<AgentConversationVersion>;

  @InjectRepository(AgentConversationMessage)
  private conversationMessageRepository!: Repository<AgentConversationMessage>;

  @InjectRepository(ConversationMessageFile)
  private conversationMessageFileRepository!: Repository<ConversationMessageFile>;

  @InjectRepository(ActivityLog)
  private activityLogRepository!: Repository<ActivityLog>;

  async saveRun(run: Partial<RuntimeRun>): Promise<RuntimeRun> {
    return this.runtimeRunRepository.save(run);
  }

  async saveMessage(message: Partial<RuntimeMessage>): Promise<RuntimeMessage> {
    return this.runtimeMessageRepository.save(message);
  }

  async saveTokenUsage(
    tokenUsage: Partial<TokenUsageSession>,
  ): Promise<TokenUsageSession> {
    return this.tokenUsageSessionRepository.save(tokenUsage);
  }

  async saveApiCallLog(apiCallLog: Partial<ApiCallLog>): Promise<ApiCallLog> {
    return this.apiCallLogRepository.save(apiCallLog);
  }

  async saveConversation(
    conversation: Partial<AgentConversation>,
  ): Promise<AgentConversation> {
    return this.conversationRepository.save(conversation);
  }

  async saveConversationVersion(
    version: Partial<AgentConversationVersion>,
  ): Promise<AgentConversationVersion> {
    return this.conversationVersionRepository.save(version);
  }

  async saveConversationMessage(
    message: Partial<AgentConversationMessage>,
  ): Promise<AgentConversationMessage> {
    return this.conversationMessageRepository.save(message);
  }

  async saveConversationMessageFile(
    link: Partial<ConversationMessageFile>,
  ): Promise<ConversationMessageFile> {
    return this.conversationMessageFileRepository.save(link);
  }

  async saveActivityLog(activityLog: Partial<ActivityLog>): Promise<ActivityLog> {
    return this.activityLogRepository.save(activityLog);
  }
}
