import { describe, expect, test } from "vitest";

import { createSessionCookie, hashPassword, verifyPassword } from "@/lib/auth/session";
import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { cloudflareResourceNames, normalizeCloudflareEnv } from "@/lib/cloudflare/env";
import { createR2Storage } from "@/lib/storage/r2";
import { createInitialState } from "@/lib/variants";

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
  test("normalizes AllChess to Cloudflare-only resources without Supabase drivers", () => {
    const env = normalizeCloudflareEnv({
      DEPLOYMENT_TARGET: "vercel",
      DATABASE_DRIVER: "supabase",
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

  test("serializes game state into D1 instead of Supabase-shaped rows", async () => {
    const mock = createMockD1();
    const repo = createD1GameRepository(mock.db as never);
    const state = createInitialState("classic", "game-d1");

    await repo.createGame({ state, privateRoom: true });

    expect(mock.calls[0]?.sql).toContain("insert into games");
    expect(mock.calls[0]?.bindings).toContain("game-d1");
    expect(mock.calls[0]?.bindings).toContain("classic");
    expect(mock.calls[0]?.bindings.some((value) => typeof value === "string" && value.includes("\"variantKey\":\"classic\""))).toBe(true);
  });
});

describe("Cloudflare-owned auth primitives", () => {
  test("hashes and verifies passwords without Supabase auth", async () => {
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
