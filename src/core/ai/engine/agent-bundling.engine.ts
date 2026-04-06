import type { ModelMessage, ToolSet, UIMessage } from "ai";
import type { AgentTool } from "../../../entities/agent-tool.entity";
import type { CapabilityProfile } from "../../../entities/capability-profile.entity";
import type { PlatformTool } from "../../../entities/platform-tool.entity";
import { AgentToolDefinitionBuilder } from "../builders/agent-tool-definition.builder";
import { MessageBundleBuilder } from "../builders/message-bundle.builder";
import { ParameterBundleBuilder } from "../builders/parameter-bundle.builder";
import { RuntimePayloadBuilder } from "../builders/runtime-payload.builder";
import { ToolBundleBuilder, type ToolDefinition } from "../builders/tool-bundle.builder";
import type { AgentRuntimeRequest } from "../contracts/runtime-payload.contract";
import type { RuntimeModelSettings, RuntimeResponseFormat } from "../contracts/parameter-bundle.contract";

export interface AgentBundlingInput {
  agentId?: string;
  organizationId?: string;
  sessionId?: string;
  conversationId?: string;
  system?: string;
  messages?: ModelMessage[];
  uiMessages?: UIMessage[];
  model?: Partial<RuntimeModelSettings>;
  responseFormat?: RuntimeResponseFormat;
  metadata?: Record<string, unknown>;
  tools?: ToolDefinition[];
  platformTools?: PlatformTool[];
  capabilityProfile?: CapabilityProfile | null;
  agentTools?: AgentTool[];
  toolChoice?: "auto" | "required" | "none";
  reasoning?: "none" | "low" | "medium" | "high";
}

export class AgentBundlingEngine {
  private readonly toolDefinitionBuilder = new AgentToolDefinitionBuilder();

  build(input: AgentBundlingInput): AgentRuntimeRequest {
    const messageBundle = new MessageBundleBuilder({
      system: input.system,
      history: input.messages,
    })
      .addUIMessages(input.uiMessages ?? [])
      .build();

    const parameterBundle = new ParameterBundleBuilder()
      .withSystem(messageBundle.system)
      .withModel(input.model ?? {})
      .withResponseFormat(input.responseFormat)
      .withToolChoice(input.toolChoice)
      .withReasoning(input.reasoning)
      .mergeMetadata(input.metadata)
      .build();

    const toolDefinitions = [
      ...this.toolDefinitionBuilder.buildFromPlatformTools({
        capabilityProfile: input.capabilityProfile,
        platformTools: input.platformTools,
      }),
      ...this.toolDefinitionBuilder.buildFromAgentTools(input.agentTools),
      ...(input.tools ?? []),
    ];

    const toolBundle = new ToolBundleBuilder().addMany(toolDefinitions).build();

    return new RuntimePayloadBuilder({
      agentId: input.agentId,
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      conversationId: input.conversationId,
      messages: messageBundle.messages,
      uiMessages: messageBundle.uiMessages,
      parameters: parameterBundle,
      tools: this.hasTools(toolBundle.tools) ? toolBundle.tools : undefined,
    }).build();
  }

  private hasTools(tools: ToolSet): boolean {
    return Object.keys(tools).length > 0;
  }
}
