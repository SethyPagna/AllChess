import { readFileSync } from "node:fs";
import { join } from "node:path";

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

  test("cloudflare durable object patch keeps matchmaking and room transmission bounded", () => {
    const patchScript = readFileSync(join(repoRoot, "ops", "scripts", "ops", "deploy", "patch-opennext-worker.ts"), "utf8");

    expect(patchScript).toContain("function allchessRatingRange");
    expect(patchScript).toContain("function allchessRoomIdFromPath");
    expect(patchScript).toContain("function allchessTicketsCompatible");
    expect(patchScript).toContain("function allchessMatch");
    expect(patchScript).toContain("broadcastSocket");
    expect(patchScript).toContain("handleSocketMessage");
    expect(patchScript).toContain("socket.readyState === 1");
    expect(patchScript).toContain("[Math.max(100, rating - 200), rating + 200]");
    expect(patchScript).toContain("body.expectedMoveVersion !== snapshot.moveVersion");
    expect(patchScript).toContain("message.expectedMoveVersion !== snapshot.moveVersion");
    expect(patchScript).toContain("snapshot.roomId = roomId");
    expect(patchScript).toContain("match_found");
    expect(patchScript).toContain("opponentTicketId");
    expect(patchScript).not.toContain("body.ratingRange ?? [0, 3000]");
  });

  test("cloudflare cache population is explicit because R2 upload retries should not block deploys", () => {
    expect(packageJson.scripts["cf:cache:populate"]).toBe("opennextjs-cloudflare populateCache remote --cacheChunkSize 1");
  });
});
