import { describe, expect, test } from "vitest";

import { auditEnv, formatEnvAudit, maskSecret } from "@/lib/validation/env-audit";

describe("environment audit", () => {
  test("validates Vercel required variables without exposing secret values", () => {
    const result = auditEnv("vercel", {
      NEXT_PUBLIC_SITE_URL: "https://allchess.vercel.app",
      DEPLOYMENT_TARGET: "vercel",
      DATABASE_DRIVER: "d1",
      OBJECT_STORAGE_DRIVER: "r2",
      SESSION_SECRET: "super-secret-session-value",
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      CLOUDFLARE_D1_DATABASE_ID: "database-id",
      CLOUDFLARE_API_TOKEN: "cloudflare-token-value",
      R2_PUBLIC_BASE_URL: "https://objects.example.com",
      AI_PROVIDER: "groq",
      GROQ_API_KEY: "groq-secret-value",
      AI_MODEL: "groq/compound"
    });

    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("super-secret-session-value");
    expect(JSON.stringify(result)).not.toContain("cloudflare-token-value");
    expect(JSON.stringify(result)).not.toContain("groq-secret-value");
  });

  test("reports missing target-specific keys and masks known secret names", () => {
    const result = auditEnv("cloudflare", {
      DEPLOYMENT_TARGET: "cloudflare",
      DATABASE_DRIVER: "d1",
      OBJECT_STORAGE_DRIVER: "r2"
    });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(["SESSION_SECRET", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_DATABASE_ID", "GAME_ROOM_DO"]));
    expect(maskSecret("OPENAI_API_KEY", "sk-live-secret")).toBe("sk-l...cret");
  });

  test("formats audit output without raw secret values", () => {
    const result = auditEnv("local", {
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      DEPLOYMENT_TARGET: "local",
      DATABASE_DRIVER: "d1",
      OBJECT_STORAGE_DRIVER: "r2",
      SESSION_SECRET: "local-session-secret",
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-local-secret",
      OPENAI_MODEL: "gpt-5.4-mini"
    });

    const output = formatEnvAudit(result);

    expect(output).toContain("AllChess env audit: local");
    expect(output).toContain("OPENAI_API_KEY=sk-l...cret");
    expect(output).not.toContain("local-session-secret");
    expect(output).not.toContain("sk-local-secret");
  });
});
