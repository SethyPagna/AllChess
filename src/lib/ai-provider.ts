type ProviderMeta = {
  label: string;
  endpoint: string;
  defaultModel: string;
  apiKeys: string[];
  timeoutMs: number;
  maxCompletionTokens: number;
  protocol: "openai-compatible" | "google";
};

type AiEnv = Record<string, string | undefined>;

export type AnalysisPayload = {
  gameId: string;
  variantKey: string;
  moves: string[];
};

export type AiProviderConfig = {
  configured: boolean;
  provider: string;
  label: string;
  model: string;
  endpoint: string;
  apiKey: string;
  timeoutMs: number;
  maxCompletionTokens: number;
  protocol: ProviderMeta["protocol"];
};

export const providerMeta: Record<string, ProviderMeta> = {
  groq: {
    label: "Groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "groq/compound",
    apiKeys: ["GROQ_API_KEY"],
    timeoutMs: 18_000,
    maxCompletionTokens: 1800,
    protocol: "openai-compatible"
  },
  mistral: {
    label: "Mistral AI",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-small-latest",
    apiKeys: ["MISTRAL_API_KEY"],
    timeoutMs: 18_000,
    maxCompletionTokens: 1400,
    protocol: "openai-compatible"
  },
  cerebras: {
    label: "Cerebras",
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
    defaultModel: "llama3.1-8b",
    apiKeys: ["CEREBRAS_API_KEY"],
    timeoutMs: 14_000,
    maxCompletionTokens: 1200,
    protocol: "openai-compatible"
  },
  google: {
    label: "Google AI",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    defaultModel: "gemini-flash-latest",
    apiKeys: ["GOOGLE_AI_API_KEY", "GEMINI_API_KEY"],
    timeoutMs: 17_000,
    maxCompletionTokens: 1600,
    protocol: "google"
  },
  openai: {
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-5.4-mini",
    apiKeys: ["OPENAI_API_KEY"],
    timeoutMs: 18_000,
    maxCompletionTokens: 1600,
    protocol: "openai-compatible"
  }
};

export function resolveAiProviderConfig(env: AiEnv = process.env): AiProviderConfig {
  const provider = normalize(env.AI_PROVIDER ?? "openai");
  const meta = providerMeta[provider] ?? providerMeta.openai;
  const model = firstValue(env.AI_MODEL, provider === "openai" ? env.OPENAI_MODEL : undefined, env.OPENAI_MODEL, meta.defaultModel);
  const endpoint = firstValue(env.AI_ENDPOINT_OVERRIDE, providerEndpointOverride(env, provider), meta.endpoint);
  const apiKey = firstValue(...meta.apiKeys.map((key) => env[key]), env.OPENAI_API_KEY);

  return {
    configured: Boolean(apiKey),
    provider: providerMeta[provider] ? provider : "openai",
    label: meta.label,
    model,
    endpoint,
    apiKey,
    timeoutMs: clampNumber(env.AI_TIMEOUT_MS, 3000, 60_000, meta.timeoutMs),
    maxCompletionTokens: clampNumber(env.AI_MAX_COMPLETION_TOKENS, 128, 8192, meta.maxCompletionTokens),
    protocol: meta.protocol
  };
}

export async function generateChessAnalysis(payload: AnalysisPayload, env: AiEnv = process.env) {
  const config = resolveAiProviderConfig(env);
  if (!config.configured) {
    return {
      mode: "demo" as const,
      provider: config.provider,
      model: config.model,
      summary: `Demo analysis for ${payload.variantKey}: develop pieces, watch king safety, and review move ${Math.max(payload.moves.length, 1)}.`,
      report: {
        moments: [],
        training: ["Replay the game from both sides.", "Compare candidate moves before committing."],
        configured: false
      }
    };
  }

  const messages = [
    {
      role: "system",
      content: "You are a chess coach. Analyze only the supplied moves. Return compact JSON with summary, moments, and training."
    },
    {
      role: "user",
      content: JSON.stringify({
        gameId: payload.gameId,
        variantKey: payload.variantKey,
        moves: payload.moves.slice(-80),
        outputShape: { summary: "", moments: [{ move: "", label: "" }], training: [""] }
      })
    }
  ];

  const text = config.protocol === "google" ? await callGoogleProvider(config, messages) : await callOpenAiCompatibleProvider(config, messages);
  const parsed = parseAssistantJson(text);
  const report = {
    moments: parsed.moments,
    training: parsed.training.length ? parsed.training : ["Replay the critical position and compare candidate plans."],
    configured: true
  };

  return {
    mode: "configured" as const,
    provider: config.provider,
    model: config.model,
    summary: parsed.summary || "Analysis completed.",
    report
  };
}

async function callOpenAiCompatibleProvider(config: AiProviderConfig, messages: Array<{ role: string; content: string }>) {
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`
    },
    signal: abortSignal(config.timeoutMs),
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.35,
      top_p: 0.95,
      stream: false,
      max_completion_tokens: config.maxCompletionTokens
    })
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message || json?.message || `AI request failed (${response.status})`);
  return trim(json?.choices?.[0]?.message?.content);
}

async function callGoogleProvider(config: AiProviderConfig, messages: Array<{ role: string; content: string }>) {
  const endpoint = `${config.endpoint}/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: abortSignal(config.timeoutMs),
    body: JSON.stringify({
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      })),
      generationConfig: {
        temperature: 0.35,
        topP: 0.95,
        maxOutputTokens: config.maxCompletionTokens
      }
    })
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message || `Google AI request failed (${response.status})`);
  return trim(json?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => trim(part.text)).filter(Boolean).join("\n"));
}

function parseAssistantJson(text: string) {
  const fallback = { summary: text, moments: [] as Array<{ move: string; label: string }>, training: [] as string[] };
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return fallback;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return {
      summary: trim(parsed.summary) || fallback.summary,
      moments: Array.isArray(parsed.moments)
        ? parsed.moments
            .map((moment: { move?: string; label?: string }) => ({ move: trim(moment.move), label: trim(moment.label) }))
            .filter((moment: { move: string; label: string }) => moment.move || moment.label)
            .slice(0, 8)
        : [],
      training: Array.isArray(parsed.training) ? parsed.training.map((item: string) => trim(item)).filter(Boolean).slice(0, 8) : []
    };
  } catch {
    return fallback;
  }
}

function providerEndpointOverride(env: AiEnv, provider: string) {
  return env[`${provider.toUpperCase()}_ENDPOINT`];
}

function abortSignal(timeoutMs: number) {
  return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(timeoutMs) : undefined;
}

function clampNumber(value: string | undefined, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function firstValue(...values: Array<string | undefined>) {
  return values.map((value) => trim(value)).find(Boolean) ?? "";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function trim(value: unknown) {
  return String(value ?? "").trim();
}
