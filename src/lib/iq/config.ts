import "server-only";

export interface IqRuntimeConfig {
  enabled: boolean;
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  maxTokens: number;
}

function envFlag(value: string | undefined, fallback: boolean) {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return fallback;
  return !(raw === "0" || raw === "false" || raw === "off" || raw === "no");
}

/**
 * Server-only IQ settings. The API key never leaves the server; the browser
 * only learns whether the assistant is enabled.
 */
export function iqConfig(): IqRuntimeConfig {
  const apiKey = (process.env.IQ_API_KEY || "").trim();
  const provider = (process.env.IQ_PROVIDER || "").trim().toLowerCase() || (apiKey ? "openai" : "mock");
  const model =
    (process.env.IQ_MODEL || "").trim() || (provider === "mock" ? "iq-grounded-mock" : "");
  return {
    enabled: envFlag(process.env.IQ_ENABLED, true),
    provider,
    model,
    baseUrl: (process.env.IQ_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    apiKey,
    maxTokens: 600,
  };
}

export function iqEnabled() {
  return iqConfig().enabled;
}
