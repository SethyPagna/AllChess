import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as { scripts: Record<string, string> };

describe("deployment scripts", () => {
  test("cloudflare build points OpenNext at the organized Wrangler config", () => {
    expect(packageJson.scripts["cf:build"]).toContain("opennextjs-cloudflare build");
    expect(packageJson.scripts["cf:build"]).toContain("--config ops/infra/cloudflare/wrangler.jsonc");
    expect(packageJson.scripts["cf:build"]).toContain("--skipNextBuild");
  });

  test("organized Wrangler config resolves OpenNext artifacts from the repository root", () => {
    const wranglerConfig = JSON.parse(readFileSync(join(repoRoot, "ops", "infra", "cloudflare", "wrangler.jsonc"), "utf8")) as {
      assets: { directory: string };
      env: { production: { name: string; services: Array<{ service: string }> } };
      main: string;
      name: string;
      services: Array<{ service: string }>;
    };

    expect(wranglerConfig.name).toBe("allchess");
    expect(wranglerConfig.services[0]?.service).toBe("allchess");
    expect(wranglerConfig.env.production.name).toBe("allchess");
    expect(wranglerConfig.env.production.services[0]?.service).toBe("allchess");
    expect(wranglerConfig.main).toBe("../../../.open-next/worker.js");
    expect(wranglerConfig.assets.directory).toBe("../../../.open-next/assets");
  });

  test("cloudflare deploy publishes the patched worker directly with Wrangler", () => {
    expect(packageJson.scripts["cf:deploy"]).toContain("wrangler deploy .open-next/worker.js");
    expect(packageJson.scripts["cf:deploy"]).toContain("--config ops/infra/cloudflare/wrangler.jsonc");
    expect(packageJson.scripts["cf:deploy"]).toContain("--env=");
    expect(packageJson.scripts["cf:deploy"]).not.toContain("opennextjs-cloudflare deploy");
    expect(packageJson.scripts["cf:deploy"]).not.toContain("populateCache remote");
  });

  test("root and organized Wrangler configs resolve the same artifacts and cache bindings", () => {
    const files = ["wrangler.jsonc", "ops/infra/cloudflare/wrangler.jsonc"];
    for (const file of files) {
      const configPath = join(repoRoot, file);
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      expect(resolve(dirname(configPath), config.main)).toBe(join(repoRoot, ".open-next", "worker.js"));
      expect(resolve(dirname(configPath), config.assets.directory)).toBe(join(repoRoot, ".open-next", "assets"));
      for (const scope of [config, config.env.production]) {
        expect(scope.r2_buckets).toContainEqual({ binding: "NEXT_INC_CACHE_R2_BUCKET", bucket_name: "allchess-opennext-cache" });
        expect(scope.vars.R2_CACHE_BINDING_NAME).toBeUndefined();
        const migrations = resolve(dirname(configPath), scope.d1_databases[0].migrations_dir);
        expect(migrations).toBe(join(repoRoot, "ops", "infra", "cloudflare", "d1", "migrations"));
        expect(existsSync(join(migrations, "0001_initial.sql"))).toBe(true);
      }
    }
  });

  test("cloudflare bundles the authoritative realtime source with production write guards", () => {
    const patchScript = readFileSync(join(repoRoot, "ops", "scripts", "ops", "deploy", "patch-opennext-worker.ts"), "utf8");

    expect(patchScript).toContain('entryPoints: ["src/lib/realtime/durable-objects.ts"]');
    expect(patchScript).toContain('external: ["cloudflare:workers"]');
    expect(patchScript).toContain('"process.env.NODE_ENV": \'"production"\'');
    expect(patchScript).toContain('from "./durable-objects/allchess.js";');
    expect(patchScript).toContain("function allchessRoomSocketRequest");
    expect(patchScript).toContain("const allchessRealtimeResponse = allchessRoomSocketRequest(request, env);");
    expect(patchScript).not.toContain("allchessTicketsCompatible");
  });

  test("cloudflare cache population is explicit because R2 upload retries should not block deploys", () => {
    expect(packageJson.scripts["cf:cache:populate"]).toBe("opennextjs-cloudflare populateCache remote --cacheChunkSize 1");
  });
});
