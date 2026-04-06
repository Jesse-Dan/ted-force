import type { ToolChoice } from "ai";
import { ModelFamily } from "../../../entities/enums/model-family.enum";
import { ModelProvider } from "../../../entities/enums/model-provider.enum";

export interface RuntimeResponseFormat {
  type: "json" | "xml" | "text" | "markdown" | "auto";
  schema?: object;
}

export interface RuntimeModelSettings {
  provider: ModelProvider;
  model: ModelFamily | string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

export interface ParameterBundle {
  system?: string;
  model: RuntimeModelSettings;
  responseFormat?: RuntimeResponseFormat;
  toolChoice?: ToolChoice<Record<string, unknown>>;
  reasoning?: "none" | "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
}
