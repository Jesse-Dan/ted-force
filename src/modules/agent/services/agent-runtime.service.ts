import { generateText, streamText, type ModelMessage } from "ai";
import { Autowired, Service } from "fragment-ts";
import type { Response } from "fragment-ts";
import type { AgentConversationVersion } from "../../../entities/agent-conversation-version.entity";
import type { AgentConversation } from "../../../entities/agent-conversation.entity";
import { ApiCallStatus } from "../../../entities/enums/api-call-status.enum";
import { AgentBundlingEngine } from "../../../core/ai/engine/agent-bundling.engine";
import { SseResponsePipe } from "../../../core/ai/sse/sse-response.pipe";
import { SseWriter } from "../../../core/ai/sse/sse-writer";
import { LanguageModelResolverService } from "../../../core/ai/services/language-model-resolver.service";
import { AgentRuntimeRequestDto } from "../dto/agent-runtime-request.dto";
import { AgentRuntimeRepository } from "../repositories/agent-runtime.repository";
import { AgentRuntimeFileContextService } from "./agent-runtime-file-context.service";
import { AgentRuntimePersistenceService } from "./agent-runtime-persistence.service";
import { RuntimeToolDefinitionService } from "./runtime-tool-definition.service";
import { AgentAwarenessService } from "./agent-awareness.service";

type PreparedRuntimeExecution = {
  agent: Awaited<ReturnType<AgentRuntimeRepository["findAgentOrThrow"]>>;
  agentConfig: NonNullable<
    Awaited<ReturnType<AgentRuntimeRepository["findAgentConfig"]>>
  >;
  latestParameters: Awaited<
    ReturnType<AgentRuntimeRepository["findLatestAgentParameter"]>
  >;
  conversation: AgentConversation;
  conversationVersion: AgentConversationVersion;
  run: Awaited<ReturnType<AgentRuntimePersistenceService["createRun"]>>;
  nextUserSequence: number;
  fileContext?: string;
  runtimeToolDefinitions: ReturnType<
    RuntimeToolDefinitionService["buildDefinitions"]
  >;
  payload: ReturnType<AgentBundlingEngine["build"]>;
};

@Service()
export class AgentRuntimeService {
  @Autowired()
  private runtimeRepository!: AgentRuntimeRepository;

  @Autowired()
  private languageModelResolver!: LanguageModelResolverService;

  @Autowired()
  private runtimePersistence!: AgentRuntimePersistenceService;

  @Autowired()
  private runtimeToolDefinitions!: RuntimeToolDefinitionService;

  @Autowired()
  private runtimeFileContext!: AgentRuntimeFileContextService;

  @Autowired()
  private agentAwarenessService!: AgentAwarenessService;

  private readonly bundlingEngine = new AgentBundlingEngine();

  private toUserFacingRuntimeError(error: unknown) {
    const message =
      error instanceof Error ? error.message : "Runtime response failed.";

    const providerPayload = error as {
      statusCode?: number;
      responseBody?: string;
      data?: { error?: { message?: string; status?: string } };
    };

    const providerMessage =
      providerPayload?.data?.error?.message ||
      (typeof providerPayload?.responseBody === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(providerPayload.responseBody);
              return parsed?.error?.message ?? null;
            } catch {
              return null;
            }
          })()
        : null);

    if (
      providerMessage?.toLowerCase().includes("api key not valid") ||
      message.toLowerCase().includes("api key not valid")
    ) {
      return "The configured model provider API key is invalid. Update the Model API Key in Config > Model.";
    }

    if (message.includes("No Gemini API key is configured")) {
      return "No model provider API key is configured. Add a Model API Key in Config > Model.";
    }

    return providerMessage || message;
  }

  async respondWithSse(
    agentId: string,
    request: AgentRuntimeRequestDto,
    response: Response,
  ): Promise<void> {
    const startedAt = Date.now();
    const prepared = await this.prepareRuntimeExecution(agentId, request);

    const sseWriter = new SseWriter(response);
    sseWriter.initialize();

    if (request.mock) {
      await this.respondWithMockSse({
        agent: prepared.agent,
        request,
        run: prepared.run,
        conversation: prepared.conversation,
        conversationVersion: prepared.conversationVersion,
        sseWriter,
        startedAt,
        latestParameters: prepared.latestParameters,
        runtimeToolDefinitions: prepared.runtimeToolDefinitions,
        nextAssistantSequence: prepared.nextUserSequence + 1,
        fileContext: prepared.fileContext,
      });
      return;
    }

    const model = this.languageModelResolver.resolve(prepared.agentConfig);
    const result = streamText({
      model,
      system: prepared.payload.parameters.system,
      messages: prepared.payload.messages,
      tools: prepared.payload.tools,
      toolChoice: prepared.payload.parameters.toolChoice,
      temperature: prepared.payload.parameters.model.temperature,
      maxOutputTokens: prepared.payload.parameters.model.maxTokens,
      topP: prepared.payload.parameters.model.topP,
      providerOptions:
        prepared.payload.parameters.model.topK != null
          ? {
              google: {
                topK: prepared.payload.parameters.model.topK,
              },
            }
          : undefined,
    });

    const ssePipe = new SseResponsePipe(sseWriter);

    try {
      await ssePipe.pipe(result.fullStream);

      const [text, finishReason, usage, toolCalls] = await Promise.all([
        result.text,
        result.finishReason,
        result.totalUsage,
        result.toolCalls,
      ]);

      const assistantMessage: ModelMessage = {
        role: "assistant",
        content: [{ type: "text", text }],
      };

      await this.runtimePersistence.persistRuntimeMessage({
        run: prepared.run,
        sessionId: request.sessionId,
        conversationId: prepared.conversation.id,
        modelMessage: assistantMessage,
        metadata: {
          finishReason,
          toolCalls,
        },
      });

      await this.runtimePersistence.persistConversationMessage({
        run: prepared.run,
        conversation: prepared.conversation,
        version: prepared.conversationVersion,
        role: "assistant",
        sequence: prepared.nextUserSequence + 1,
        text,
        modelMessage: assistantMessage,
        metadata: {
          finishReason,
          toolCalls,
        },
      });

      await this.runtimePersistence.persistTokenUsage({
        runId: prepared.run.id,
        sessionId: request.sessionId,
        modelName: String(prepared.agentConfig.model),
        usage,
      });

      await this.runtimePersistence.finalizeRun({
        run: prepared.run,
        toolCallCount: toolCalls.length,
        responseMs: Date.now() - startedAt,
      });

      await this.runtimePersistence.persistApiCallLog({
        agent: prepared.agent,
        request,
        durationInMilliseconds: Date.now() - startedAt,
        status: ApiCallStatus.SUCCESS,
        responseBody: {
          finishReason,
          toolCallCount: toolCalls.length,
          conversationId: prepared.conversation.id,
          conversationVersion: prepared.conversationVersion.versionNumber,
        },
      });
    } catch (error) {
      const safeErrorMessage = this.toUserFacingRuntimeError(error);
      await this.runtimePersistence.finalizeRun({
        run: prepared.run,
        responseMs: Date.now() - startedAt,
        error: safeErrorMessage,
      });

      await this.runtimePersistence.persistApiCallLog({
        agent: prepared.agent,
        request,
        durationInMilliseconds: Date.now() - startedAt,
        status: ApiCallStatus.FAILED,
        errorMessage: safeErrorMessage,
      });

      sseWriter.write({
        type: "error",
        data: {
          message: safeErrorMessage,
        },
      });
      sseWriter.done();
    }
  }

  async respond(agentId: string, request: AgentRuntimeRequestDto) {
    const startedAt = Date.now();
    const prepared = await this.prepareRuntimeExecution(agentId, request);

    try {
      let text = "";
      let finishReason: string = "stop";
      let usage: unknown = undefined;
      let toolCalls: unknown[] = [];

      if (request.mock) {
        text = this.buildMockText({
          agentName: prepared.agent.name,
          system: prepared.payload.parameters.system,
          messages: prepared.payload.messages,
          toolCount: prepared.runtimeToolDefinitions.length,
        });
      } else {
        const result = await generateText({
          model: this.languageModelResolver.resolve(prepared.agentConfig),
          system: prepared.payload.parameters.system,
          messages: prepared.payload.messages,
          tools: prepared.payload.tools,
          toolChoice: prepared.payload.parameters.toolChoice,
          temperature: prepared.payload.parameters.model.temperature,
          maxOutputTokens: prepared.payload.parameters.model.maxTokens,
          topP: prepared.payload.parameters.model.topP,
          providerOptions:
            prepared.payload.parameters.model.topK != null
              ? {
                  google: {
                    topK: prepared.payload.parameters.model.topK,
                  },
                }
              : undefined,
        });

        text = result.text;
        finishReason = result.finishReason;
        usage = result.totalUsage;
        toolCalls = result.toolCalls;
      }

      const assistantMessage: ModelMessage = {
        role: "assistant",
        content: [{ type: "text", text }],
      };

      await this.runtimePersistence.persistRuntimeMessage({
        run: prepared.run,
        sessionId: request.sessionId,
        conversationId: prepared.conversation.id,
        modelMessage: assistantMessage,
        metadata: {
          finishReason,
          toolCalls,
          mock: request.mock ?? false,
        },
      });

      await this.runtimePersistence.persistConversationMessage({
        run: prepared.run,
        conversation: prepared.conversation,
        version: prepared.conversationVersion,
        role: "assistant",
        sequence: prepared.nextUserSequence + 1,
        text,
        modelMessage: assistantMessage,
        metadata: {
          finishReason,
          toolCalls,
          mock: request.mock ?? false,
        },
      });

      await this.runtimePersistence.persistTokenUsage({
        runId: prepared.run.id,
        sessionId: request.sessionId,
        modelName: String(prepared.agentConfig.model),
        usage: usage as any,
      });

      await this.runtimePersistence.finalizeRun({
        run: prepared.run,
        toolCallCount: toolCalls.length,
        responseMs: Date.now() - startedAt,
      });

      await this.runtimePersistence.persistApiCallLog({
        agent: prepared.agent,
        request,
        durationInMilliseconds: Date.now() - startedAt,
        status: ApiCallStatus.SUCCESS,
        responseBody: {
          finishReason,
          toolCallCount: toolCalls.length,
          conversationId: prepared.conversation.id,
          conversationVersion: prepared.conversationVersion.versionNumber,
        },
      });

      return {
        text,
        finishReason,
        usage: usage ?? null,
        toolCalls,
        conversationId: prepared.conversation.id,
        conversationVersion: prepared.conversationVersion.versionNumber,
        runId: prepared.run.id,
        sessionId: request.sessionId ?? null,
      };
    } catch (error) {
      const safeErrorMessage = this.toUserFacingRuntimeError(error);
      await this.runtimePersistence.finalizeRun({
        run: prepared.run,
        responseMs: Date.now() - startedAt,
        error: safeErrorMessage,
      });

      await this.runtimePersistence.persistApiCallLog({
        agent: prepared.agent,
        request,
        durationInMilliseconds: Date.now() - startedAt,
        status: ApiCallStatus.FAILED,
        errorMessage: safeErrorMessage,
      });

      throw new Error(safeErrorMessage);
    }
  }

  private async prepareRuntimeExecution(
    agentId: string,
    request: AgentRuntimeRequestDto,
  ): Promise<PreparedRuntimeExecution> {
    const agent = await this.runtimeRepository.findAgentOrThrow(agentId);
    const agentConfig = await this.runtimeRepository.findAgentConfig(agentId);

    if (!agentConfig) {
      throw new Error(`Agent ${agentId} is missing configuration.`);
    }

    const latestParameters = await this.runtimeRepository.findAgentParameterSnapshot({
      agentId,
      commitHash: request.commitHash,
      instanceId: request.instanceId,
    });
    const agentTools = await this.runtimeRepository.findAgentToolSnapshot({
      agentId,
      commitHash: request.commitHash,
      instanceId: request.instanceId,
    });
    const conversation = await this.resolveConversation(agent, request);
    const conversationVersion = await this.resolveConversationVersion(conversation);
    const historyMessages = await this.runtimeRepository.findConversationMessages(
      conversation.id,
      conversationVersion.id,
    );
    const userMessage = this.createUserMessage(request.input);
    const modelMessages = [
      ...historyMessages
        .map((message) => message.modelMessage)
        .filter((message): message is ModelMessage => Boolean(message)),
      userMessage,
    ];

    const run = await this.runtimePersistence.createRun({
      agent,
      sessionId: request.sessionId,
      conversationId: conversation.id,
      conversationVersionId: conversationVersion.id,
    });

    const nextUserSequence = historyMessages.length + 1;

    const persistedUserMessage = await this.runtimePersistence.persistConversationMessage({
      run,
      conversation,
      version: conversationVersion,
      role: "user",
      sequence: nextUserSequence,
      text: request.input,
      modelMessage: userMessage,
    });

    await this.runtimeFileContext.linkRequestFilesToMessage({
      conversationMessage: persistedUserMessage,
      fileIds: request.fileIds,
    });

    await this.runtimePersistence.persistRuntimeMessage({
      run,
      sessionId: request.sessionId,
      conversationId: conversation.id,
      modelMessage: userMessage,
    });

    const capabilityProfile = latestParameters?.capabilityProfile ?? null;
    const platformTools =
      capabilityProfile?.toolPolicies?.map((policy) => policy.platformTool) ?? [];
    const fileContext = await this.runtimeFileContext.buildConversationFileContext({
      conversationId: conversation.id,
      conversationVersionId: conversationVersion.id,
    });
    const runtimeToolDefinitions = this.runtimeToolDefinitions.buildDefinitions({
      agentId: agent.id,
      sessionId: request.sessionId ?? run.id,
      commitHash: request.commitHash,
      instanceId: request.instanceId,
      capabilityProfile,
      platformTools,
      agentTools,
      webSearch: request.webSearch,
    });

    const systemPrompt = await this.composeSystemPrompt(
      agent.id,
      request.sessionId ?? run.id,
      request.system,
      latestParameters,
      fileContext,
    );

    const payload = this.bundlingEngine.build({
      agentId: agent.id,
      organizationId: agent.organizationId ?? undefined,
      sessionId: request.sessionId,
      conversationId: conversation.id,
      system: systemPrompt,
      messages: modelMessages,
      model: {
        provider: agentConfig.provider,
        model: agentConfig.model,
        temperature: agentConfig.temperature,
        maxTokens: agentConfig.maxTokens,
        topP: agentConfig.topP,
        topK: agentConfig.topK,
      },
      responseFormat: latestParameters?.responseFormat,
      metadata: {
        agentName: agent.name,
        parameterId: latestParameters?.id,
        conversationVersion: conversationVersion.versionNumber,
        webSearch: request.webSearch ?? true,
        fileCount: request.fileIds?.length ?? 0,
        commitHash: request.commitHash,
        instanceId: request.instanceId,
      },
      tools: runtimeToolDefinitions,
      toolChoice:
        capabilityProfile?.capabilityFlags?.functionCalling === false
          ? "none"
          : "auto",
      reasoning: request.reasoning,
    });

    return {
      agent,
      agentConfig,
      latestParameters,
      conversation,
      conversationVersion,
      run,
      nextUserSequence,
      fileContext,
      runtimeToolDefinitions,
      payload,
    };
  }

  private async respondWithMockSse(input: {
    agent: Awaited<ReturnType<AgentRuntimeRepository["findAgentOrThrow"]>>;
    request: AgentRuntimeRequestDto;
    run: Awaited<ReturnType<AgentRuntimePersistenceService["createRun"]>>;
    conversation: AgentConversation;
    conversationVersion: AgentConversationVersion;
    sseWriter: SseWriter;
    startedAt: number;
    latestParameters: Awaited<
      ReturnType<AgentRuntimeRepository["findLatestAgentParameter"]>
    >;
    runtimeToolDefinitions: ReturnType<
      RuntimeToolDefinitionService["buildDefinitions"]
    >;
    nextAssistantSequence: number;
    fileContext?: string;
  }): Promise<void> {
    try {
      const mockText = this.buildMockText({
        agentName: input.agent.name,
        system: await this.composeSystemPrompt(
          input.agent.id,
          input.request.sessionId ?? input.run.id,
          input.request.system,
          input.latestParameters,
          input.fileContext,
        ),
        messages: [this.createUserMessage(input.request.input)],
        toolCount: input.runtimeToolDefinitions.length,
      });

      input.sseWriter.write({
        type: "start",
        data: {
          mock: true,
          agentId: input.agent.id,
          conversationId: input.conversation.id,
        },
      });

      for (const chunk of this.chunkText(mockText)) {
        input.sseWriter.write({
          type: "delta",
          data: {
            type: "text-delta",
            textDelta: chunk,
            mock: true,
          },
        });
      }

      input.sseWriter.write({
        type: "finish",
        data: {
          finishReason: "stop",
          mock: true,
        },
      });
      input.sseWriter.done();

      const assistantMessage: ModelMessage = {
        role: "assistant",
        content: [{ type: "text", text: mockText }],
      };

      await this.runtimePersistence.persistRuntimeMessage({
        run: input.run,
        sessionId: input.request.sessionId,
        conversationId: input.conversation.id,
        modelMessage: assistantMessage,
        metadata: {
          finishReason: "stop",
          mock: true,
          toolCallCount: 0,
        },
      });

      await this.runtimePersistence.persistConversationMessage({
        run: input.run,
        conversation: input.conversation,
        version: input.conversationVersion,
        role: "assistant",
        sequence: input.nextAssistantSequence,
        text: mockText,
        modelMessage: assistantMessage,
        metadata: {
          finishReason: "stop",
          mock: true,
        },
      });

      await this.runtimePersistence.finalizeRun({
        run: input.run,
        toolCallCount: 0,
        responseMs: Date.now() - input.startedAt,
      });

      await this.runtimePersistence.persistApiCallLog({
        agent: input.agent,
        request: input.request,
        durationInMilliseconds: Date.now() - input.startedAt,
        status: ApiCallStatus.SUCCESS,
        responseBody: {
          finishReason: "stop",
          mock: true,
          toolCallCount: 0,
          conversationId: input.conversation.id,
          conversationVersion: input.conversationVersion.versionNumber,
        },
      });
    } catch (error) {
      await this.runtimePersistence.finalizeRun({
        run: input.run,
        responseMs: Date.now() - input.startedAt,
        error: error instanceof Error ? error.message : "Mock SSE response failed.",
      });

      await this.runtimePersistence.persistApiCallLog({
        agent: input.agent,
        request: input.request,
        durationInMilliseconds: Date.now() - input.startedAt,
        status: ApiCallStatus.FAILED,
        errorMessage:
          error instanceof Error ? error.message : "Mock SSE response failed.",
      });

      input.sseWriter.write({
        type: "error",
        data: {
          message:
            error instanceof Error
              ? error.message
              : "Mock SSE response failed.",
        },
      });
      input.sseWriter.done();
    }
  }

  private async resolveConversation(
    agent: Awaited<ReturnType<AgentRuntimeRepository["findAgentOrThrow"]>>,
    request: AgentRuntimeRequestDto,
  ): Promise<AgentConversation> {
    const existingConversation = await this.runtimeRepository.findConversation(
      agent.id,
      request.conversationId,
    );

    if (existingConversation) {
      return existingConversation;
    }

    return this.runtimePersistence.createConversation({
      agent,
      conversationId: request.conversationId,
      sessionId: request.sessionId,
      title: request.input.slice(0, 80),
    });
  }

  private async resolveConversationVersion(
    conversation: AgentConversation,
  ): Promise<AgentConversationVersion> {
    const existingVersion = await this.runtimeRepository.findConversationVersion(
      conversation.id,
      conversation.currentVersionNumber,
    );

    if (existingVersion) {
      return existingVersion;
    }

    return this.runtimePersistence.createConversationVersion({
      conversation,
    });
  }

  private createUserMessage(input: string): ModelMessage {
    return {
      role: "user",
      content: [{ type: "text", text: input }],
    };
  }

  private async composeSystemPrompt(
    agentId: string,
    sessionId: string | undefined,
    requestedSystem: string | undefined,
    latestParameters: Awaited<
      ReturnType<AgentRuntimeRepository["findLatestAgentParameter"]>
    >,
    fileContext?: string,
  ): Promise<string | undefined> {
    const persistentMemoryEnabled =
      latestParameters?.contextRuleSet?.persistentMemory === true;
    const awarenessContext = persistentMemoryEnabled
      ? await this.agentAwarenessService.loadContextLines(agentId, sessionId)
      : [];
    const awarenessSection =
      awarenessContext.length > 0
        ? ["Awareness Context:", ...awarenessContext.map((line) => `- ${line}`)].join(
            "\n",
          )
        : undefined;
    const parts = [
      requestedSystem,
      latestParameters?.overview,
      latestParameters?.documentation,
      awarenessSection,
      fileContext,
      ...(latestParameters?.corePrompts ?? []),
    ].filter(Boolean);

    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }

  private buildMockText(input: {
    agentName: string;
    system?: string;
    messages: ModelMessage[];
    toolCount: number;
  }): string {
    const lastUserPrompt = this.extractLastUserPrompt(input.messages);
    const systemSuffix = input.system
      ? `System context was bundled successfully.`
      : `No extra system context was supplied.`;

    return [
      `Mock response from ${input.agentName}.`,
      systemSuffix,
      `This request ran in test mode without calling a live model.`,
      `Bundled tool definitions available: ${input.toolCount}.`,
      lastUserPrompt
        ? `Last user prompt summary: ${lastUserPrompt}`
        : `No user prompt content was provided.`,
    ].join(" ");
  }

  private extractLastUserPrompt(messages: ModelMessage[]): string | undefined {
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!lastUserMessage) {
      return undefined;
    }

    if (typeof lastUserMessage.content === "string") {
      return lastUserMessage.content.slice(0, 280);
    }

    const text = lastUserMessage.content
      .flatMap((part) => {
        if (typeof part === "string") {
          return [part];
        }

        if ("type" in part && part.type === "text" && "text" in part) {
          return [part.text];
        }

        return [];
      })
      .join(" ")
      .trim();

    return text ? text.slice(0, 280) : undefined;
  }

  private chunkText(text: string): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const word of words) {
      const nextChunk = currentChunk ? `${currentChunk} ${word}` : word;

      if (nextChunk.length > 48) {
        if (currentChunk) {
          chunks.push(`${currentChunk} `);
        }
        currentChunk = word;
        continue;
      }

      currentChunk = nextChunk;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}
