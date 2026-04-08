import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { createOllama } from "ai-sdk-ollama";
import { Service, Value } from "fragment-ts";
import { AgentConfig } from "../../../entities/agent-config.entity";
import { ModelProvider } from "../../../entities/enums/model-provider.enum";

@Service()
export class LanguageModelResolverService {
  @Value("GOOGLE_GENERATIVE_AI_API_KEY")
  private googleGenerativeAiApiKey?: string;

  @Value("GEMINI_API_KEY")
  private geminiApiKey?: string;

  @Value("OLLAMA_BASE_URL")
  private ollamaBaseUrl?: string;

  @Value("OLLAMA_HOST")
  private ollamaHost?: string;

    @Value("OLLAMA_HOST")
  private ollamaAPIKEY?: string;

  resolve(agentConfig: AgentConfig): LanguageModel {
    const modelName = agentConfig.model;

    switch (agentConfig.provider) {
      case ModelProvider.GEMINI: {
        const apiKey =
          agentConfig.systemApiKey ||
          this.googleGenerativeAiApiKey ||
          this.geminiApiKey;

        if (!apiKey) {
          throw new Error(
            "No Gemini API key is configured on the agent or environment.",
          );
        }

        const google = createGoogleGenerativeAI({ apiKey });
        return google(modelName);
      }

      case ModelProvider.DIGITWHALE: {
        const baseURL = "https://llm.digitwhale.com/api";
        const ollama = createOllama(baseURL ? { baseURL,apiKey:this.ollamaAPIKEY } : {});
        return ollama(modelName);
      }

      case ModelProvider.OLLAMA: {
        const baseURL = this.ollamaBaseUrl || this.ollamaHost || undefined;
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