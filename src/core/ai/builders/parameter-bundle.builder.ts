import { ModelFamily } from "../../../entities/enums/model-family.enum";
import { ModelProvider } from "../../../entities/enums/model-provider.enum";
import type {
  ParameterBundle,
  RuntimeModelSettings,
  RuntimeResponseFormat,
} from "../contracts/parameter-bundle.contract";

const defaultModelSettings: RuntimeModelSettings = {
  provider: ModelProvider.GEMINI,
  model: ModelFamily.GEMINI_2_5_FLASH_LITE,
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  topK: 50,
};

export class ParameterBundleBuilder {
  private bundle: ParameterBundle = {
    model: { ...defaultModelSettings },
  };

  withSystem(system?: string): this {
    this.bundle.system = system;
    return this;
  }

  withModel(settings: Partial<RuntimeModelSettings>): this {
    this.bundle.model = {
      ...this.bundle.model,
      ...settings,
    };
    return this;
  }

  withResponseFormat(responseFormat?: RuntimeResponseFormat): this {
    this.bundle.responseFormat = responseFormat;
    return this;
  }

  withToolChoice(toolChoice?: ParameterBundle["toolChoice"]): this {
    this.bundle.toolChoice = toolChoice;
    return this;
  }

  withReasoning(reasoning?: ParameterBundle["reasoning"]): this {
    this.bundle.reasoning = reasoning;
    return this;
  }

  mergeMetadata(metadata?: Record<string, unknown>): this {
    this.bundle.metadata = {
      ...(this.bundle.metadata ?? {}),
      ...(metadata ?? {}),
    };
    return this;
  }

  build(): ParameterBundle {
    return {
      ...this.bundle,
      model: { ...this.bundle.model },
      reasoning: this.bundle.reasoning,
      metadata: this.bundle.metadata ? { ...this.bundle.metadata } : undefined,
    };
  }
}
