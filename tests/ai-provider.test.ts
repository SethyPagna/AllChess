import { afterEach, describe, expect, test, vi } from "vitest";

import { generateChessAnalysis, resolveAiProviderConfig } from "@/lib/ai-provider";

describe("AI provider adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("resolves Business OS style provider defaults and env key aliases", () => {
    const config = resolveAiProviderConfig({
      AI_PROVIDER: "groq",
      GROQ_API_KEY: "groq-secret",
      AI_MODEL: "groq/compound"
    });

    expect(config).toMatchObject({
      configured: true,
      provider: "groq",
      model: "groq/compound",
      endpoint: "https://api.groq.com/openai/v1/chat/completions"
    });
    expect(config.apiKey).toBe("groq-secret");
  });

  test("calls an OpenAI-compatible provider and returns chess analysis text", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "{\"summary\":\"Castle earlier and contest the center.\",\"training\":[\"Review king safety.\"]}" } }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await generateChessAnalysis(
      { gameId: "game-1", variantKey: "classic", moves: ["P6,4-4,4"] },
      {
        AI_PROVIDER: "mistral",
        MISTRAL_API_KEY: "mistral-secret",
        AI_MODEL: "mistral-small-latest"
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mistral.ai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer mistral-secret" })
      })
    );
    expect(result).toMatchObject({
      mode: "configured",
      provider: "mistral",
      model: "mistral-small-latest",
      summary: "Castle earlier and contest the center.",
      report: { training: ["Review king safety."], configured: true }
    });
  });
});
