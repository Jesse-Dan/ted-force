import type { ModelMessage, ToolSet, UIMessage } from "ai";
import type { ParameterBundle } from "./parameter-bundle.contract";

export interface AgentRuntimeRequest {
  agentId?: string;
  organizationId?: string;
  sessionId?: string;
  conversationId?: string;
  messages: ModelMessage[];
  uiMessages?: UIMessage[];
  parameters: ParameterBundle;
  tools?: ToolSet;
}

export interface AgentRuntimeContext {
  requestId?: string;
  userId?: string;
  agentId?: string;
  organizationId?: string;
  sessionId?: string;
}
