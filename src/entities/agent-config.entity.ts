import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { AuditableEntity } from "./base/auditable.entity";
import { Agent } from "./agent.entity";
import { ModelFamily } from "./enums/model-family.enum";
import { ModelProvider } from "./enums/model-provider.enum";

export interface RuntimeLimits {
  requestsPerMinute: number;
  tokenLimit: number;
  tokensUsed: number;
  allowPaidActions?: boolean;
  useCreditAccount?: boolean;
  requireCreditAccount?: boolean;
  maxSpendPerRunUsd?: number;
  maxSpendPerMonthUsd?: number;
}

export interface SdkRateLimitPolicy {
  requestsPerMinute: number;
  burstCapacity: number;
  adaptiveThrottling: boolean;
  blockAnonymousTraffic: boolean;
}

export interface SdkSecurityPolicy {
  allowedIpAddresses: string[];
}

export interface SdkWidgetThemeConfig {
  primaryAccentToken: string;
  launcherPosition: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  greetingPrompt: string;
  launcherLabel: string;
  borderRadius: number;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  showBranding: boolean;
  proactiveGreeting: boolean;
  autoOpenOnReturn: boolean;
}

export interface SdkWidgetConfig {
  widgetKey: string | null;
  allowedDomains: string[];
  embedEnabled: boolean;
  theme: SdkWidgetThemeConfig;
}

export const DEFAULT_RUNTIME_LIMITS: RuntimeLimits = {
  requestsPerMinute: 40,
  tokenLimit: 0,
  tokensUsed: 0,
  allowPaidActions: false,
  useCreditAccount: true,
  requireCreditAccount: true,
  maxSpendPerRunUsd: 25,
  maxSpendPerMonthUsd: 250,
};

export const DEFAULT_SDK_RATE_LIMIT_POLICY: SdkRateLimitPolicy = {
  requestsPerMinute: 120,
  burstCapacity: 300,
  adaptiveThrottling: true,
  blockAnonymousTraffic: false,
};

export const DEFAULT_SDK_SECURITY_POLICY: SdkSecurityPolicy = {
  allowedIpAddresses: [],
};

export const DEFAULT_SDK_WIDGET_THEME: SdkWidgetThemeConfig = {
  primaryAccentToken: "--tuul-accent-500",
  launcherPosition: "bottom-right",
  greetingPrompt: "Hi, I'm here to help. What can I do for you today?",
  launcherLabel: "Chat with us",
  borderRadius: 20,
  backgroundColor: "#09090b",
  surfaceColor: "#18181b",
  textColor: "#fafafa",
  mutedTextColor: "#a1a1aa",
  showBranding: true,
  proactiveGreeting: true,
  autoOpenOnReturn: false,
};

export const DEFAULT_SDK_WIDGET_CONFIG: SdkWidgetConfig = {
  widgetKey: null,
  allowedDomains: [],
  embedEnabled: false,
  theme: DEFAULT_SDK_WIDGET_THEME,
};

@Entity("agent_configs")
export class AgentConfig extends AuditableEntity {
  @Column({ name: "agent_id", type: "uuid" })
  agentId!: string;

  @OneToOne(() => Agent, (agent) => agent.config, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_id" })
  agent!: Agent;

  @Column({ name: "system_api_key", type: "varchar", length: 255, nullable: true })
  systemApiKey?: string | null;

  @Column({
    name: "provider",
    type: "enum",
    enum: ModelProvider,
    default: ModelProvider.GEMINI,
  })
  provider!: ModelProvider;

  @Column({
    name: "model",
    type: "enum",
    enum: ModelFamily,
    default: ModelFamily.GEMINI_2_5_FLASH_LITE,
  })
  model!: ModelFamily;

  @Column({ name: "temperature", type: "float", default: 0.7 })
  temperature!: number;

  @Column({ name: "max_tokens", type: "int", default: 2048 })
  maxTokens!: number;

  @Column({ name: "top_p", type: "float", default: 1 })
  topP!: number;

  @Column({ name: "top_k", type: "int", default: 50 })
  topK!: number;

  @Column({ name: "is_system_healthy", type: "boolean", default: true })
  isSystemHealthy!: boolean;

  @Column({ name: "last_security_audit_at", type: "timestamp", nullable: true })
  lastSecurityAuditAt?: Date | null;

  @Column({
    name: "runtime_limits",
    type: "json",
    nullable: true,
  })
  runtimeLimits?: RuntimeLimits | null;

  @Column({
    name: "sdk_rate_limits",
    type: "json",
    nullable: true,
  })
  sdkRateLimits?: SdkRateLimitPolicy | null;

  @Column({
    name: "sdk_security",
    type: "json",
    nullable: true,
  })
  sdkSecurity?: SdkSecurityPolicy | null;

  @Column({
    name: "sdk_widget",
    type: "json",
    nullable: true,
  })
  sdkWidget?: SdkWidgetConfig | null;
}
