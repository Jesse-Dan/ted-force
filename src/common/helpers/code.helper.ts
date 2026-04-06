import crypto from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

type CodeCharset = "alphanumeric" | "numeric" | "alpha" | "hex" | "custom";
type ApiKeyEnvironment = "live" | "test";
type ReferencePrefix = string;

interface CodeConfig {
  length: number;
  charset?: CodeCharset;
  customChars?: string;
  prefix?: string;
  suffix?: string;
}

interface SecureReferenceConfig {
  prefix?: ReferencePrefix;
  hashLength?: number;
  userId?: number | string;
}

interface ApiKeyConfig {
  prefix?: string;
  environment?: ApiKeyEnvironment;
  byteLength?: number;
}

// ─── Presets ─────────────────────────────────────────────────────────────────

const CODE_PRESETS = {
  otp: { length: 6, charset: "numeric" } satisfies CodeConfig,
  token: { length: 32, charset: "alphanumeric" } satisfies CodeConfig,
  slug: { length: 8, charset: "hex" } satisfies CodeConfig,
  pin: { length: 4, charset: "numeric" } satisfies CodeConfig,
  shortCode: { length: 6, charset: "alpha" } satisfies CodeConfig,
} as const;

const REFERENCE_PRESETS = {
  default: { prefix: "DGW-", hashLength: 14 } satisfies SecureReferenceConfig,
  order: { prefix: "ORD-", hashLength: 12 } satisfies SecureReferenceConfig,
  transaction: { prefix: "TXN-", hashLength: 16 } satisfies SecureReferenceConfig,
  support: { prefix: "SUP-", hashLength: 10 } satisfies SecureReferenceConfig,
} as const;

const API_KEY_PRESETS = {
  live: { prefix: "tuul_sk", environment: "live", byteLength: 32 } satisfies ApiKeyConfig,
  test: { prefix: "tuul_sk", environment: "test", byteLength: 32 } satisfies ApiKeyConfig,
  restricted: { prefix: "tuul_rk", environment: "live", byteLength: 24 } satisfies ApiKeyConfig,
} as const;

// ─── Charset Map ─────────────────────────────────────────────────────────────

const CHARSETS: Record<CodeCharset, string> = {
  alphanumeric: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  numeric: "0123456789",
  alpha: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  hex: "0123456789abcdef",
  custom: "",
};

// ─── Class ───────────────────────────────────────────────────────────────────

export class CodeHelper {
  // ── Code Generation ────────────────────────────────────────────────────────

  static generate(config: CodeConfig | keyof typeof CODE_PRESETS): string {
    const resolved: CodeConfig =
      typeof config === "string" ? CODE_PRESETS[config] : config;

    const { length, charset = "alphanumeric", customChars, prefix = "", suffix = "" } = resolved;

    const chars =
      charset === "custom"
        ? (customChars ?? (() => { throw new Error("customChars required when charset is 'custom'"); })())
        : CHARSETS[charset];

    let code = "";
    for (let i = 0; i < length; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    return `${prefix}${code}${suffix}`;
  }

  // ── Secure Reference ───────────────────────────────────────────────────────

  static generateSecureReference(
    config: SecureReferenceConfig | keyof typeof REFERENCE_PRESETS = "default"
  ): string {
    const resolved: SecureReferenceConfig =
      typeof config === "string" ? REFERENCE_PRESETS[config] : config;

    const { prefix = "DGW-", hashLength = 14, userId = "guest" } = resolved;

    const hash = crypto
      .createHash("sha256")
      .update(`${Date.now()}${Math.random()}${userId}`)
      .digest("hex");

    return `${prefix}${hash.substring(0, hashLength)}`;
  }

  // ── API Key ────────────────────────────────────────────────────────────────

  static generateApiKey(
    config: ApiKeyConfig | keyof typeof API_KEY_PRESETS = "live"
  ): string {
    const resolved: ApiKeyConfig =
      typeof config === "string" ? API_KEY_PRESETS[config] : config;

    const { prefix = "tuul_sk", environment = "live", byteLength = 32 } = resolved;

    const secret = crypto.randomBytes(byteLength).toString("hex");
    return `${prefix}_${environment}_${secret}`;
  }

  // ── Error Extraction ───────────────────────────────────────────────────────

  static extractErrorMessage(error: unknown): string {
    const fallback = "An unknown error occurred.";

    if (typeof error === "string") return error;
    if (Array.isArray(error)) return error[0]?.message ?? fallback;
    if (error instanceof Error) return error.message ?? fallback;
    if (typeof error === "object" && error !== null) {
      return (error as Record<string, unknown>).message as string ?? fallback;
    }

    return fallback;
  }
}

// ─── Re-export presets for external use ──────────────────────────────────────

export { API_KEY_PRESETS, CODE_PRESETS, REFERENCE_PRESETS };
export type { ApiKeyConfig, ApiKeyEnvironment, CodeCharset, CodeConfig, SecureReferenceConfig };

// Presets
// CodeHelper.generate("otp");                          // 6-digit number
// CodeHelper.generate("token");                        // 32-char alphanumeric
// CodeHelper.generateSecureReference("transaction");   // TXN-<16 chars>
// CodeHelper.generateApiKey("test");                   // tuul_sk_test_<hex>

// // Custom config
// CodeHelper.generate({ length: 10, charset: "hex", prefix: "IMG-" });
// CodeHelper.generateSecureReference({ prefix: "USR-", hashLength: 20, userId: 42 });
// CodeHelper.generateApiKey({ prefix: "acme_sk", environment: "live", byteLength: 48 });