import type { ModelMessage, ToolSet, UIMessage } from "ai";
import type {
  AgentRuntimeRequest,
} from "../contracts/runtime-payload.contract";
import type { ParameterBundle } from "../contracts/parameter-bundle.contract";

export interface RuntimePayloadBuilderOptions {
  agentId?: string;
  organizationId?: string;
  sessionId?: string;
  conversationId?: string;
  messages?: ModelMessage[];
  uiMessages?: UIMessage[];
  parameters: ParameterBundle;
  tools?: ToolSet;
}

export class RuntimePayloadBuilder {
  constructor(private readonly options: RuntimePayloadBuilderOptions) {}

  build(): AgentRuntimeRequest {
    return {
      agentId: this.options.agentId,
      organizationId: this.options.organizationId,
      sessionId: this.options.sessionId,
      conversationId: this.options.conversationId,
      messages: [...(this.options.messages ?? [])],
      uiMessages: this.options.uiMessages
        ? [...this.options.uiMessages]
        : undefined,
      parameters: this.options.parameters,
      tools: this.options.tools,
    };
  }
}
