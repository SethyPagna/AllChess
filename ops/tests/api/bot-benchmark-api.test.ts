import { describe, expect, test, vi } from "vitest";

import type { D1Database } from "@cloudflare/workers-types";

const runtime = vi.hoisted(() => ({
  env: {} as { ALLCHESS_D1?: D1Database }
}));

vi.mock("@/lib/cloudflare/runtime", () => ({
  getCloudflareRuntimeEnv: async () => runtime.env
}));

import { POST } from "@/app/api/bots/benchmark/route";

function createBenchmarkD1() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values });
          return {
            async run() {
              return { success: true };
            }
          };
        }
      };
    }
  } as unknown as D1Database;

  return { db, calls };
}

describe("bot benchmark API", () => {
  test("records requested tier with the shared strength band", async () => {
    runtime.env = {};
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
      persisted: false,
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

  test("persists compact benchmark summary when D1 is configured", async () => {
    const { db, calls } = createBenchmarkD1();
    runtime.env = { ALLCHESS_D1: db };

    const response = await POST(
      new Request("http://allchess.test/api/bots/benchmark", {
        method: "POST",
        body: JSON.stringify({
          variantKey: "classic",
          tier: "grandmaster",
          suite: "tactics",
          positions: 24,
          score: 18,
          illegalMoves: 0
        })
      })
    );
    const body = await response.json();

    expect(body).toMatchObject({
      variantKey: "classic",
      tier: "grandmaster",
      suite: "tactics",
      positions: 24,
      score: 18,
      illegalMoves: 0,
      persisted: true
    });
    const insert = calls.find((call) => call.sql.includes("insert into bot_benchmark_runs"));
    expect(insert?.values.slice(1, 7)).toEqual(["classic", "grandmaster", body.benchmarkVersion, 24, 18, 0]);
    expect(JSON.parse(insert?.values[7] as string)).toMatchObject({
      id: body.id,
      variantKey: "classic",
      tier: "grandmaster",
      suite: "tactics",
      persisted: true
    });
  });
});
