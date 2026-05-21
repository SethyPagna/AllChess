import { describe, expect, test } from "vitest";

import { createSessionCookie, hashPassword, verifyPassword } from "@/lib/auth/session";
import { createD1RestDatabase } from "@/lib/cloudflare/d1-rest";
import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { cloudflareResourceNames, normalizeCloudflareEnv } from "@/lib/cloudflare/env";
import { createR2Storage } from "@/lib/storage/r2";
import { createInitialState } from "@/lib/variants";
import { readFileSync } from "node:fs";

function createMockD1() {
  const calls: Array<{ sql: string; bindings: unknown[] }> = [];
  return {
    calls,
    db: {
      prepare(sql: string) {
        return {
          bind(...bindings: unknown[]) {
            calls.push({ sql, bindings });
            return {
              async run() {
                return { success: true };
              },
              async first() {
                return null;
              },
              async all() {
                return { results: [] };
              }
            };
          }
        };
      }
    }
  };
}

describe("Cloudflare platform configuration", () => {
  test("includes D1 tables for catalog metadata, rules versions, leaderboards, and review summaries", () => {
    const migration = readFileSync("cloudflare/d1/migrations/0003_catalog_leaderboards.sql", "utf8");

    expect(migration).toContain("create table if not exists game_catalog_entries");
    expect(migration).toContain("create table if not exists rules_versions");
    expect(migration).toContain("create table if not exists leaderboards");
    expect(migration).toContain("create table if not exists game_review_summaries");
  });

  test("normalizes AllChess to Cloudflare-only resources without legacy database drivers", () => {
    const env = normalizeCloudflareEnv({
      DEPLOYMENT_TARGET: "vercel",
      DATABASE_DRIVER: "legacy-database",
      OBJECT_STORAGE_DRIVER: "s3"
    });

    expect(env.DEPLOYMENT_TARGET).toBe("vercel");
    expect(env.DATABASE_DRIVER).toBe("d1");
    expect(env.OBJECT_STORAGE_DRIVER).toBe("r2");
    expect(cloudflareResourceNames).toEqual({
      app: "allchess",
      d1Database: "allchess",
      objectsBucket: "allchess-objects",
      previewObjectsBucket: "allchess-objects-preview",
      cacheBucket: "allchess-opennext-cache"
    });
  });

  test("prefixes R2 object keys under allchess to avoid cross-product writes", async () => {
    const puts: Array<{ key: string; body: unknown }> = [];
    const storage = createR2Storage(
      {
        ALLCHESS_OBJECTS: {
          put: async (key: string, body: unknown) => {
            puts.push({ key, body });
            return null;
          }
        } as never
      },
      "https://assets.example.com"
    );

    const saved = await storage.put({ key: "/avatars/player.png", body: "image", contentType: "image/png" });

    expect(puts[0]?.key).toBe("allchess/avatars/player.png");
    expect(saved.key).toBe("allchess/avatars/player.png");
    expect(saved.url).toBe("https://assets.example.com/allchess/avatars/player.png");
  });

  test("serializes game state into D1-native rows", async () => {
    const mock = createMockD1();
    const repo = createD1GameRepository(mock.db as never);
    const state = createInitialState("classic", "game-d1");

    await repo.createGame({ state, privateRoom: true });

    expect(mock.calls[0]?.sql).toContain("insert into games");
    expect(mock.calls[0]?.bindings).toContain("game-d1");
    expect(mock.calls[0]?.bindings).toContain("classic");
    expect(mock.calls[0]?.bindings.some((value) => typeof value === "string" && value.includes("\"variantKey\":\"classic\""))).toBe(true);
  });

  test("persists realtime rooms and reads live stats from D1", async () => {
    const mock = createMockD1();
    const repo = createD1GameRepository(mock.db as never);
    const state = createInitialState("classic", "room-game");
    const snapshot = {
      roomId: "room-1",
      gameId: state.id,
      variantKey: state.variantKey,
      status: state.status,
      players: [],
      spectators: 3,
      clocks: state.clocks,
      state,
      moveVersion: 0,
      rated: true,
      chatPolicy: "players" as const
    };

    await repo.createRoom({ snapshot, roomCode: "ROOM42" });
    const stats = await repo.getLiveStats();

    expect(mock.calls.some((call) => call.sql.includes("insert into rooms"))).toBe(true);
    expect(mock.calls.some((call) => call.bindings.includes("ROOM42"))).toBe(true);
    expect(stats.source).toBe("durable-object");
  });

  test("creates a D1 REST adapter for Vercel when Cloudflare bindings are unavailable", async () => {
    const calls: Array<{ url: string; body: string | null; auth: string | null }> = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (async (url, init) => {
      calls.push({
        url: String(url),
        body: String(init?.body ?? ""),
        auth: new Headers(init?.headers).get("authorization")
      });
      return Response.json({ success: true, result: [{ success: true, results: [{ activeRooms: 1 }] }] });
    }) as typeof fetch;

    try {
      const db = createD1RestDatabase({
        CLOUDFLARE_ACCOUNT_ID: "account",
        CLOUDFLARE_D1_DATABASE_ID: "database",
        CLOUDFLARE_API_TOKEN: "token"
      });
      const row = await db!.prepare("select count(*) as activeRooms from rooms where status = ?").bind("active").first<{ activeRooms: number }>();

      expect(row?.activeRooms).toBe(1);
      expect(calls[0]?.url).toContain("/accounts/account/d1/database/database/query");
      expect(calls[0]?.body).toContain("\"params\":[\"active\"]");
      expect(calls[0]?.auth).toBe("Bearer token");
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});

describe("Cloudflare-owned auth primitives", () => {
  test("hashes and verifies passwords with Cloudflare-owned auth", async () => {
    const hashed = await hashPassword("correct horse battery staple");

    expect(hashed).toMatch(/^pbkdf2-sha256\$/);
    await expect(verifyPassword("correct horse battery staple", hashed)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hashed)).resolves.toBe(false);
  });

  test("creates secure app session cookies", () => {
    const cookie = createSessionCookie("session-123", 3600);

    expect(cookie.name).toBe("allchess_session");
    expect(cookie.value).toBe("session-123");
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.sameSite).toBe("lax");
    expect(cookie.options.maxAge).toBe(3600);
  });
});
