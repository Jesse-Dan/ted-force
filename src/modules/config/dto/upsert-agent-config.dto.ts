import { Validate, Validators } from "fragment-ts";
import { ModelFamily } from "../../../entities/enums/model-family.enum";
import { ModelProvider } from "../../../entities/enums/model-provider.enum";

export class UpsertAgentConfigDto {
  @Validate({ name: "systemApiKey" })
  @Validators.IsOptional()
  @Validators.IsString()
  systemApiKey?: string | null;

  @Validate({ name: "provider" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(ModelProvider))
  provider?: ModelProvider;

  @Validate({ name: "model" })
  @Validators.IsOptional()
  @Validators.IsIn(Object.values(ModelFamily))
  model?: ModelFamily;

  @Validate({ name: "temperature" })
  @Validators.IsOptional()
  @Validators.IsNumber()
  temperature?: number;

  @Validate({ name: "maxTokens" })
  @Validators.IsOptional()
  @Validators.IsInt()
  maxTokens?: number;

  @Validate({ name: "topP" })
  @Validators.IsOptional()
  @Validators.IsNumber()
  topP?: number;

  @Validate({ name: "topK" })
  @Validators.IsOptional()
  @Validators.IsInt()
  topK?: number;

  @Validate({ name: "isSystemHealthy" })
  @Validators.IsOptional()
  @Validators.IsBoolean()
  isSystemHealthy?: boolean;

  @Validate({ name: "runtimeLimits" })
  @Validators.IsOptional()
  @Validators.IsObject()
  runtimeLimits?: {
    requestsPerMinute?: number;
    tokenLimit?: number;
    tokensUsed?: number;
    allowPaidActions?: boolean;
    useCreditAccount?: boolean;
    requireCreditAccount?: boolean;
    maxSpendPerRunUsd?: number;
    maxSpendPerMonthUsd?: number;
  } | null;

  @Validate({ name: "sdkRateLimits" })
  @Validators.IsOptional()
  @Validators.IsObject()
  sdkRateLimits?: {
    requestsPerMinute?: number;
    burstCapacity?: number;
    adaptiveThrottling?: boolean;
    blockAnonymousTraffic?: boolean;
  } | null;

  @Validate({ name: "sdkSecurity" })
  @Validators.IsOptional()
  @Validators.IsObject()
  sdkSecurity?: {
    allowedIpAddresses?: string[];
  } | null;

  @Validate({ name: "sdkWidget" })
  @Validators.IsOptional()
  @Validators.IsObject()
  sdkWidget?: {
    widgetKey?: string | null;
    allowedDomains?: string[];
    embedEnabled?: boolean;
    theme?: {
      primaryAccentToken?: string;
      launcherPosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
      greetingPrompt?: string;
      launcherLabel?: string;
      borderRadius?: number;
      backgroundColor?: string;
      surfaceColor?: string;
      textColor?: string;
      mutedTextColor?: string;
      showBranding?: boolean;
      proactiveGreeting?: boolean;
      autoOpenOnReturn?: boolean;
    } | null;
  } | null;
}
