import { describe, expect, test } from "vitest";

import { GET } from "@/app/api/bots/models/route";

describe("bot models API", () => {
  test("reports runtime language strategy and indexed knowledge status", async () => {
    const response = GET();
    const body = await response.json();

    expect(body.runtime).toMatchObject({
      primaryRuntime: "typescript",
      hotPathStrategy: "indexed-typescript-plus-wasm-engines"
    });
    expect(body.runtime.runtimeLanguages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language: "TypeScript", status: "active" }),
        expect.objectContaining({ language: "WebAssembly/C++", status: "active" })
      ])
    );
    expect(body.knowledgeIndex.entries).toBeGreaterThan(0);
    expect(body.knowledgeIndex.maxBucketSize).toBeLessThan(body.knowledgeIndex.entries);
  });
});
