import type { LanguageModelUsage, ModelMessage } from "ai";
import { Autowired, Service } from "fragment-ts";
import type { AgentConversationVersion } from "../../../entities/agent-conversation-version.entity";
import type { AgentConversation } from "../../../entities/agent-conversation.entity";
import type { AgentConversationMessage } from "../../../entities/agent-conversation-message.entity";
import type { StoredFile } from "../../../entities/stored-file.entity";
import { ApiCallStatus } from "../../../entities/enums/api-call-status.enum";
import { HttpMethod } from "../../../entities/enums/http-method.enum";
import type { Agent } from "../../../entities/agent.entity";
import type { RuntimeRun } from "../../../entities/runtime-run.entity";
import { RequestContextHolder } from "../../../common/context/request-context-holder";
import { AgentRuntimePersistenceRepository } from "../repositories/agent-runtime-persistence.repository";
import type { AgentRuntimeRequestDto } from "../dto/agent-runtime-request.dto";

@Service()
export class AgentRuntimePersistenceService {
  @Autowired()
  private persistenceRepository!: AgentRuntimePersistenceRepository;

  async createConversation(input: {
    agent: Agent;
    conversationId?: string;
    sessionId?: string;
    title?: string;
  }): Promise<AgentConversation> {
    return this.persistenceRepository.saveConversation({
      id: input.conversationId,
      agentId: input.agent.id,
      agent: input.agent,
      sessionId: input.sessionId,
      title: input.title ?? null,
      currentVersionNumber: 1,
      state: null,
    });
  }

  async createConversationVersion(input: {
    conversation: AgentConversation;
    label?: string;
  }): Promise<AgentConversationVersion> {
    return this.persistenceRepository.saveConversationVersion({
      conversationId: input.conversation.id,
      conversation: input.conversation,
      versionNumber: input.conversation.currentVersionNumber,
      label: input.label ?? "Main",
      metadata: null,
    });
  }

  async createRun(input: {
    agent: Agent;
    sessionId?: string;
    conversationId?: string;
    conversationVersionId?: string;
  }): Promise<RuntimeRun> {
    const context = RequestContextHolder.get();
    const run = await this.persistenceRepository.saveRun({
      agentId: input.agent.id,
      agent: input.agent,
      name: `${input.agent.slug}-runtime`,
      kind: "live",
      instanceName: input.agent.slug,
      isRunning: true,
      sessionId: input.sessionId,
      conversationId: input.conversationId,
      conversationVersionId: input.conversationVersionId,
      isDefault: false,
      stats: {
        messages: 0,
        functionsCalled: 0,
        avgResponse: 0,
        errors: 0,
      },
    });

    await this.persistenceRepository.saveActivityLog({
      agentId: input.agent.id,
      agent: input.agent,
      entry: {
        type: "runtime.run.started",
        runId: run.id,
        requestId: context?.requestId ?? null,
        sessionId: input.sessionId ?? context?.sessionId ?? null,
        conversationId: input.conversationId ?? null,
      },
    });

    return run;
  }

  async persistConversationMessage(input: {
    run?: RuntimeRun;
    conversation: AgentConversation;
    version: AgentConversationVersion;
    role: "system" | "user" | "assistant" | "tool";
    sequence: number;
    text?: string;
    modelMessage?: ModelMessage;
    metadata?: Record<string, unknown>;
  }): Promise<AgentConversationMessage> {
    return this.persistenceRepository.saveConversationMessage({
      runId: input.run?.id,
      run: input.run,
      conversationId: input.conversation.id,
      conversation: input.conversation,
      conversationVersionId: input.version.id,
      version: input.version,
      role: input.role,
      sequence: input.sequence,
      text: input.text ?? null,
      modelMessage: input.modelMessage ?? null,
      metadata: input.metadata ?? null,
    });
  }

  async linkFilesToConversationMessage(input: {
    conversationMessage: AgentConversationMessage;
    files: StoredFile[];
  }): Promise<void> {
    for (const file of input.files) {
      await this.persistenceRepository.saveConversationMessageFile({
        conversationMessageId: input.conversationMessage.id,
        conversationMessage: input.conversationMessage,
        storedFileId: file.id,
        storedFile: file,
        attachmentLabel: file.originalFilename,
      });
    }
  }

  async persistRuntimeMessage(input: {
    run: RuntimeRun;
    sessionId?: string;
    conversationId?: string;
    modelMessage: ModelMessage;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.persistenceRepository.saveMessage({
      runId: input.run.id,
      run: input.run,
      role: input.modelMessage.role,
      modelMessage: input.modelMessage,
      sessionId: input.sessionId,
      conversationId: input.conversationId,
      metadata: input.metadata ?? null,
    });
  }

  async finalizeRun(input: {
    run: RuntimeRun;
    toolCallCount?: number;
    responseMs: number;
    error?: string;
  }): Promise<void> {
    const context = RequestContextHolder.get();
    const currentStats = input.run.stats ?? {
      messages: 0,
      functionsCalled: 0,
      avgResponse: 0,
      errors: 0,
    };

    await this.persistenceRepository.saveRun({
      ...input.run,
      isRunning: false,
      stats: {
        messages: (currentStats.messages ?? 0) + 1,
        functionsCalled: input.toolCallCount ?? currentStats.functionsCalled ?? 0,
        avgResponse: input.responseMs,
        errors: input.error ? 1 : 0,
      },
      errorLogs: input.error
        ? [
            ...(input.run.errorLogs ?? []),
            {
              message: input.error,
              timestamp: new Date().toISOString(),
            },
          ]
        : input.run.errorLogs,
    });

    await this.persistenceRepository.saveActivityLog({
      agentId: input.run.agentId,
      entry: {
        type: input.error ? "runtime.run.failed" : "runtime.run.completed",
        runId: input.run.id,
        requestId: context?.requestId ?? null,
        responseMs: input.responseMs,
        toolCallCount: input.toolCallCount ?? 0,
        error: input.error ?? null,
      },
    });
  }

  async persistTokenUsage(input: {
    runId: string;
    sessionId?: string;
    modelName: string;
    usage?: LanguageModelUsage;
  }): Promise<void> {
    if (!input.usage) {
      return;
    }

    const inputTokens = input.usage.inputTokens ?? 0;
    const outputTokens = input.usage.outputTokens ?? 0;
    const totalTokens = input.usage.totalTokens ?? inputTokens + outputTokens;

    await this.persistenceRepository.saveTokenUsage({
      runId: input.runId,
      source: "tuul",
      mode: "live",
      sessionId: input.sessionId ?? null,
      modelName: input.modelName,
      inputTokens: { inputTokens },
      outputTokens: { outputTokens },
      availableTokensBefore: 0,
      usableTokens: totalTokens,
      availableTokensAfter: 0,
    });
  }

  async persistApiCallLog(input: {
    agent: Agent;
    request: AgentRuntimeRequestDto;
    durationInMilliseconds: number;
    status: ApiCallStatus;
    errorMessage?: string;
    responseBody?: Record<string, unknown>;
  }): Promise<void> {
    const context = RequestContextHolder.get();
    await this.persistenceRepository.saveApiCallLog({
      agentId: input.agent.id,
      agent: input.agent,
      endpoint: `/agents/${input.agent.id}/runtime`,
      method: HttpMethod.POST,
      requestBody: {
        requestId: context?.requestId ?? null,
        input: input.request.input,
        sessionId: input.request.sessionId,
        conversationId: input.request.conversationId,
        mock: input.request.mock ?? false,
        reasoning: input.request.reasoning ?? "medium",
        webSearch: input.request.webSearch ?? true,
        fileIds: input.request.fileIds ?? [],
      },
      responseBody: input.responseBody,
      status: input.status,
      errorMessage: input.errorMessage,
      ipAddress: context?.ip ?? null,
      userAgent: context?.userAgent ?? null,
      durationInMilliseconds: input.durationInMilliseconds,
    });
  }
}
