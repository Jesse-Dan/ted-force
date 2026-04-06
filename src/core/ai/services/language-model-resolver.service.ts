import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOllama } from "ai-sdk-ollama";
import type { LanguageModel } from "ai";
import { Service } from "fragment-ts";
import { AgentConfig } from "../../../entities/agent-config.entity";
import { ModelProvider } from "../../../entities/enums/model-provider.enum";

@Service()
export class LanguageModelResolverService {
  resolve(agentConfig: AgentConfig): LanguageModel {
    const modelName = agentConfig.model;

    switch (agentConfig.provider) {
      case ModelProvider.GEMINI: {
        const apiKey =
          agentConfig.systemApiKey ||
          process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
          process.env.GEMINI_API_KEY;

        if (!apiKey) {
          throw new Error(
            "No Gemini API key is configured on the agent or environment.",
          );
        }

        const google = createGoogleGenerativeAI({ apiKey });
        return google(modelName);
      }

      case ModelProvider.OLLAMA: {
        const baseURL =
          process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || undefined;
        const ollama = createOllama(baseURL ? { baseURL } : {});
        return ollama(modelName);
      }

      case ModelProvider.OPENAI:
      case ModelProvider.ANTHROPIC:
      case ModelProvider.CUSTOM:
      default:
        throw new Error(
          `Provider ${agentConfig.provider} is not installed in v2 yet.`,
        );
    }
  }
}
