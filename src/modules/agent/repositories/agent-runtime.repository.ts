import {
  FragmentRepository,
  InjectRepository,
  Repository,
} from "fragment-ts";
import { AgentConfig } from "../../../entities/agent-config.entity";
import { AgentConversationMessage } from "../../../entities/agent-conversation-message.entity";
import { AgentConversationVersion } from "../../../entities/agent-conversation-version.entity";
import { AgentConversation } from "../../../entities/agent-conversation.entity";
import { AgentInstance } from "../../../entities/agent-instance.entity";
import { AgentParameter } from "../../../entities/agent-parameter.entity";
import { AgentTool } from "../../../entities/agent-tool.entity";
import { Agent } from "../../../entities/agent.entity";
import { ConversationMessageFile } from "../../../entities/conversation-message-file.entity";
import { StoredFile } from "../../../entities/stored-file.entity";

@FragmentRepository()
export class AgentRuntimeRepository {
  @InjectRepository(Agent)
  private agentRepository!: Repository<Agent>;

  @InjectRepository(AgentConfig)
  private agentConfigRepository!: Repository<AgentConfig>;

  @InjectRepository(AgentParameter)
  private agentParameterRepository!: Repository<AgentParameter>;

  @InjectRepository(AgentInstance)
  private agentInstanceRepository!: Repository<AgentInstance>;

  @InjectRepository(AgentTool)
  private agentToolRepository!: Repository<AgentTool>;

  @InjectRepository(AgentConversation)
  private conversationRepository!: Repository<AgentConversation>;

  @InjectRepository(AgentConversationVersion)
  private conversationVersionRepository!: Repository<AgentConversationVersion>;

  @InjectRepository(AgentConversationMessage)
  private conversationMessageRepository!: Repository<AgentConversationMessage>;

  @InjectRepository(ConversationMessageFile)
  private conversationMessageFileRepository!: Repository<ConversationMessageFile>;

  @InjectRepository(StoredFile)
  private storedFileRepository!: Repository<StoredFile>;

  async findAgentOrThrow(agentId: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
    });

    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    return agent;
  }

  async findAgentConfig(agentId: string): Promise<AgentConfig | null> {
    return this.agentConfigRepository.findOne({
      where: { agentId },
      relations: {
        agent: true,
      },
    });
  }

  async findLatestAgentParameter(agentId: string): Promise<AgentParameter | null> {
    return this.agentParameterRepository.findOne({
      where: { agentId },
      relations: {
        capabilityProfile: {
          toolPolicies: {
            platformTool: true,
          },
        },
        contextRuleSet: true,
        voiceProfile: true,
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findAgentParameterSnapshot(input: {
    agentId: string;
    commitHash?: string;
    instanceId?: string;
  }): Promise<AgentParameter | null> {
    if (input.instanceId) {
      const instance = await this.agentInstanceRepository.findOne({
        where: { id: input.instanceId, agentId: input.agentId },
      });

      if (!instance) {
        throw new Error(`Instance ${input.instanceId} not found for agent ${input.agentId}.`);
      }

      if (instance.commitHash) {
        return this.findAgentParameterSnapshot({
          agentId: input.agentId,
          commitHash: instance.commitHash,
        });
      }
    }

    if (input.commitHash) {
      return this.agentParameterRepository.findOne({
        where: {
          agentId: input.agentId,
          commitHash: input.commitHash,
        },
        relations: {
          capabilityProfile: {
            toolPolicies: {
              platformTool: true,
            },
          },
          contextRuleSet: true,
          voiceProfile: true,
        },
        order: {
          createdAt: "DESC",
        },
      });
    }

    return this.findLatestAgentParameter(input.agentId);
  }

  async findEnabledAgentTools(agentId: string): Promise<AgentTool[]> {
    return this.agentToolRepository.find({
      where: {
        agentId,
        enabled: true,
      },
      order: {
        createdAt: "ASC",
      },
    });
  }

  async findAgentToolSnapshot(input: {
    agentId: string;
    commitHash?: string;
    instanceId?: string;
  }): Promise<AgentTool[]> {
    if (input.instanceId) {
      const instance = await this.agentInstanceRepository.findOne({
        where: { id: input.instanceId, agentId: input.agentId },
      });

      if (!instance) {
        throw new Error(`Instance ${input.instanceId} not found for agent ${input.agentId}.`);
      }

      if (instance.commitHash) {
        return this.findAgentToolSnapshot({
          agentId: input.agentId,
          commitHash: instance.commitHash,
        });
      }
    }

    if (input.commitHash) {
      return this.agentToolRepository.find({
        where: {
          agentId: input.agentId,
          commitHash: input.commitHash,
          enabled: true,
        },
        order: {
          createdAt: "ASC",
        },
      });
    }

    return this.findEnabledAgentTools(input.agentId);
  }

  async findConversation(
    agentId: string,
    conversationId?: string,
  ): Promise<AgentConversation | null> {
    if (!conversationId) {
      return null;
    }

    return this.conversationRepository.findOne({
      where: { id: conversationId, agentId },
    });
  }

  async findConversationsByAgentIdAndSessionId(
    agentId: string,
    sessionId: string,
  ): Promise<AgentConversation[]> {
    return this.conversationRepository.find({
      where: { agentId, sessionId },
      relations: {
        agent: true,
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async saveConversation(
    conversation: Partial<AgentConversation>,
  ): Promise<AgentConversation> {
    return this.conversationRepository.save(conversation);
  }

  async deleteConversation(conversationId: string): Promise<{ id: string; deleted: true }> {
    await this.conversationMessageRepository.delete({ conversationId });
    await this.conversationRepository.delete(conversationId);
    return {
      id: conversationId,
      deleted: true,
    };
  }

  async findConversationVersion(
    conversationId: string,
    versionNumber: number,
  ): Promise<AgentConversationVersion | null> {
    return this.conversationVersionRepository.findOne({
      where: { conversationId, versionNumber },
    });
  }

  async findConversationMessages(
    conversationId: string,
    conversationVersionId: string,
  ): Promise<AgentConversationMessage[]> {
    return this.conversationMessageRepository.find({
      where: {
        conversationId,
        conversationVersionId,
      },
      order: {
        sequence: "ASC",
      },
    });
  }

  async findMessagesByAgentIdAndConversationId(
    agentId: string,
    conversationId: string,
  ): Promise<AgentConversationMessage[]> {
    return this.conversationMessageRepository.find({
      where: {
        conversationId,
        conversation: {
          agentId,
        },
      },
      relations: {
        conversation: true,
      },
      order: {
        sequence: "ASC",
      },
    });
  }

  async findFilesByIds(fileIds: string[]): Promise<StoredFile[]> {
    if (fileIds.length === 0) {
      return [];
    }

    return this.storedFileRepository.find({
      where: fileIds.map((id) => ({
        id,
        isActive: true,
      })),
      order: {
        createdAt: "ASC",
      },
    });
  }

  async findLinkedFilesForConversation(
    conversationId: string,
    conversationVersionId: string,
  ): Promise<Array<{ link: ConversationMessageFile; file: StoredFile }>> {
    const links = await this.conversationMessageFileRepository.find({
      where: {
        conversationMessage: {
          conversationId,
          conversationVersionId,
        },
      },
      relations: {
        storedFile: true,
        conversationMessage: true,
      },
      order: {
        createdAt: "ASC",
      },
    });

    return links
      .filter((link) => Boolean(link.storedFile?.isActive))
      .map((link) => ({
        link,
        file: link.storedFile,
      }));
  }
}
