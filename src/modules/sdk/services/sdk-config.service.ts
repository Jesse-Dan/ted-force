import { Service } from "fragment-ts";

@Service()
export class SdkConfigService {
  getManifest() {
    const baseUrl =
      process.env.SDK_PUBLIC_BASE_URL?.trim() ||
      process.env.PUBLIC_BASE_URL?.trim() ||
      process.env.APP_BASE_URL?.trim() ||
      "http://localhost:4000";

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
      endpoints: {
        prompt: "/sdk/agents/:agentId/prompt",
        conversations: "/sdk/conversations/:sessionId",
        messages: "/sdk/messages/:conversationId",
        runMessages: "/sdk/messages/run/:runId",
        resources: "/sdk/resources/:sessionId",
      },
    };
  }
}
