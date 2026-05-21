export type EnvAuditTarget = "local" | "vercel" | "cloudflare" | "docker";

export type EnvAuditResult = {
  target: EnvAuditTarget;
  ok: boolean;
  required: string[];
  optional: string[];
  missing: string[];
  configured: Record<string, string>;
  warnings: string[];
};

const baseRequired = ["DEPLOYMENT_TARGET", "DATABASE_DRIVER", "OBJECT_STORAGE_DRIVER", "SESSION_SECRET"];
const cloudflareAccountRequired = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_DATABASE_ID"];
const cloudflareBindingRequired = ["ALLCHESS_D1", "ALLCHESS_OBJECTS"];
const objectStorageRequired = ["R2_PUBLIC_BASE_URL"];
const realtimeRequired = ["GAME_ROOM_DO", "MATCHMAKING_DO", "PRESENCE_DO"];
const optional = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "CLOUDFLARE_ZONE_ID", "CLOUDFLARE_DOMAIN"];

const providerKeyByName: Record<string, string[]> = {
  groq: ["GROQ_API_KEY"],
  mistral: ["MISTRAL_API_KEY"],
  cerebras: ["CEREBRAS_API_KEY"],
  google: ["GOOGLE_AI_API_KEY", "GEMINI_API_KEY"],
  openai: ["OPENAI_API_KEY"]
};

export function auditEnv(target: EnvAuditTarget, env: Record<string, string | undefined> = process.env): EnvAuditResult {
  const provider = normalize(env.AI_PROVIDER ?? "openai");
  const required = requiredKeysFor(target, provider);
  const missing = required.filter((key) => !hasValue(env[key]));
  const configured = Object.fromEntries(required.filter((key) => hasValue(env[key])).map((key) => [key, maskSecret(key, env[key] ?? "")]));
  const warnings = buildWarnings(target, provider, env);

  return {
    target,
    ok: missing.length === 0,
    required,
    optional,
    missing,
    configured,
    warnings
  };
}

export function formatEnvAudit(result: EnvAuditResult) {
  const status = result.ok ? "ok" : "missing required values";
  const lines = [`AllChess env audit: ${result.target}`, `Status: ${status}`];
  lines.push(`Required: ${result.required.join(", ")}`);

  if (result.missing.length) {
    lines.push(`Missing: ${result.missing.join(", ")}`);
  }

  const configured = Object.entries(result.configured).map(([key, value]) => `${key}=${value}`);
  if (configured.length) {
    lines.push("Configured:");
    lines.push(...configured.map((entry) => `- ${entry}`));
  }

  if (result.warnings.length) {
    lines.push("Warnings:");
    lines.push(...result.warnings.map((warning) => `- ${warning}`));
  }

  return `${lines.join("\n")}\n`;
}

export function maskSecret(name: string, value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (!isSecretName(name)) return "set";
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}***${trimmed.slice(-1)}`;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function requiredKeysFor(target: EnvAuditTarget, provider: string) {
  const providerKeys = providerKeyByName[provider] ?? providerKeyByName.openai;
  const aiRequired = ["AI_PROVIDER", provider === "openai" ? "OPENAI_MODEL" : "AI_MODEL", ...providerKeys];

  if (target === "local") {
    return ["NEXT_PUBLIC_SITE_URL", ...baseRequired, ...aiRequired];
  }

  if (target === "docker") {
    return ["NEXT_PUBLIC_SITE_URL", ...baseRequired, ...cloudflareAccountRequired, ...objectStorageRequired, ...aiRequired];
  }

  if (target === "cloudflare") {
    return [...baseRequired, ...cloudflareAccountRequired, ...cloudflareBindingRequired, ...realtimeRequired, ...aiRequired];
  }

  return ["NEXT_PUBLIC_SITE_URL", ...baseRequired, ...cloudflareAccountRequired, "CLOUDFLARE_API_TOKEN", ...objectStorageRequired, ...aiRequired];
}

function buildWarnings(target: EnvAuditTarget, provider: string, env: Record<string, string | undefined>) {
  const warnings: string[] = [];
  if (target === "vercel" && env.NEXT_PUBLIC_SITE_URL && !env.NEXT_PUBLIC_SITE_URL.includes("allchess")) {
    warnings.push("NEXT_PUBLIC_SITE_URL should point to the allchess deployment.");
  }
  if (provider === "openai" && env.AI_MODEL && !env.OPENAI_MODEL) {
    warnings.push("OPENAI_MODEL is preferred for the OpenAI provider; AI_MODEL is accepted only by the provider adapter.");
  }
  if (env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_GLOBAL_API_KEY) {
    warnings.push("Cloudflare credentials must stay in provider secret stores and must not be committed.");
  }
  return warnings;
}

function isSecretName(name: string) {
  return /TOKEN|SECRET|KEY|PASSWORD/i.test(name);
}

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
