import { describe, expect, test } from "vitest";

import { POST } from "@/app/api/bots/benchmark/route";

describe("bot benchmark API", () => {
  test("records requested tier with the shared strength band", async () => {
    const request = new Request("http://allchess.test/api/bots/benchmark", {
      method: "POST",
      body: JSON.stringify({
        variantKey: "classic",
        tier: "legend",
        suite: "smoke",
        positions: 12
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body).toMatchObject({
      variantKey: "classic",
      tier: "legend",
      positions: 12,
      accepted: true,
      claimStatus: "verified",
      runtimePolicy: "cache-first",
      latencyTargetMs: 2800,
      strongerThan: "grandmaster",
      fixtureFamilies: expect.arrayContaining(["mate", "rescue", "counterattack", "draw-saving"]),
      strength: {
        display: "3190+ benchmark",
        targetElo: 3190,
        stockfishUciElo: 3190
      }
    });
  });
});
