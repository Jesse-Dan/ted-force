import { Service } from "fragment-ts";

export interface SdkEndpointDefinition {
  id: string;
  name: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  scope: "read" | "write" | "widget";
  summary: string;
  description: string;
  exampleRequest?: Record<string, unknown> | null;
  exampleResponse?: Record<string, unknown> | null;
}

@Service()
export class SdkConfigService {
  getBaseUrl() {
    return (
      process.env.SDK_PUBLIC_BASE_URL?.trim() ||
      process.env.PUBLIC_BASE_URL?.trim() ||
      process.env.APP_BASE_URL?.trim() ||
      "http://localhost:4000"
    );
  }

  getEndpointCatalog(): SdkEndpointDefinition[] {
    return [
      {
        id: "prompt",
        name: "Prompt Agent",
        method: "POST",
        path: "/sdk/agents/:agentId/prompt",
        scope: "write",
        summary: "Run a prompt against an agent",
        description:
          "Supports streaming and non-streaming replies for SDK and API consumers.",
        exampleRequest: {
          stream: true,
          sessionId: "web-session-123",
          conversationId: "optional-conversation-id",
          message: "Summarize today's support backlog.",
        },
        exampleResponse: {
          eventStream: "SSE delta stream or JSON response when stream=false",
        },
      },
      {
        id: "conversations",
        name: "List Conversations",
        method: "GET",
        path: "/sdk/agents/:agentId/conversations/:sessionId",
        scope: "read",
        summary: "Load conversations for a session",
        description:
          "Returns prior SDK conversations for the given agent and client session.",
        exampleResponse: {
          data: [{ id: "conversation-id", title: "Support Follow-up" }],
        },
      },
      {
        id: "conversation-rename",
        name: "Rename Conversation",
        method: "PATCH",
        path: "/sdk/agents/:agentId/conversations/:conversationId",
        scope: "write",
        summary: "Rename a conversation",
        description: "Updates the visible title of a stored SDK conversation.",
        exampleRequest: {
          title: "Quarterly Support Review",
        },
      },
      {
        id: "conversation-delete",
        name: "Delete Conversation",
        method: "DELETE",
        path: "/sdk/agents/:agentId/conversations/:conversationId",
        scope: "write",
        summary: "Delete a conversation",
        description: "Removes the conversation and its messages from SDK history.",
      },
      {
        id: "messages",
        name: "Get Messages",
        method: "GET",
        path: "/sdk/agents/:agentId/messages/:conversationId",
        scope: "read",
        summary: "Load conversation messages",
        description: "Returns the stored messages for a conversation.",
      },
      {
        id: "run-messages",
        name: "Get Run Messages",
        method: "GET",
        path: "/sdk/agents/:agentId/messages/run/:runId",
        scope: "read",
        summary: "Load messages for a runtime run",
        description: "Fetches all runtime messages associated with a run id.",
      },
      {
        id: "resources",
        name: "List Resources",
        method: "GET",
        path: "/sdk/agents/:agentId/resources/:sessionId",
        scope: "read",
        summary: "Load SDK resources for a session",
        description:
          "Returns resources and attachments generated inside an SDK client session.",
      },
      {
        id: "widget-config",
        name: "Widget Config",
        method: "GET",
        path: "/sdk/agents/:agentId/widget",
        scope: "widget",
        summary: "Load public widget configuration",
        description:
          "Returns the persisted embed + theme configuration for the agent widget.",
      },
      {
        id: "widget-embed",
        name: "Widget Embed Snippet",
        method: "GET",
        path: "/sdk/agents/:agentId/widget/embed",
        scope: "widget",
        summary: "Get generated embed snippet",
        description:
          "Returns the current embed snippet for installing the Tuul widget on a site.",
      },
      {
        id: "security",
        name: "SDK Security Policy",
        method: "GET",
        path: "/sdk/agents/:agentId/security",
        scope: "read",
        summary: "Load active SDK IP allowlist policy",
        description:
          "Returns the SDK-wide IP allowlist enforced for API and widget routes.",
      },
    ];
  }

  getManifest() {
    const baseUrl = this.getBaseUrl();
    const endpointCatalog = this.getEndpointCatalog();

    return {
      packageName: "tuul_sdk",
      runtime: "sse",
      baseUrl,
      providerComponent: "TuulAgentProvider",
      widgets: ["fab", "inline-chat", "trigger-button"],
      config: {
        required: ["agentId"],
        optional: [
          "apiKey",
          "baseUrl",
          "position",
          "theme",
          "color",
          "style",
          "borderRadius",
          "zIndex",
          "launcherLabel",
        ],
      },
      endpoints: Object.fromEntries(
        endpointCatalog.map((endpoint) => [endpoint.id, endpoint.path]),
      ),
      endpointCatalog,
    };
  }
}
