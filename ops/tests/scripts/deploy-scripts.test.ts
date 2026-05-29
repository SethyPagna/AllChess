import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };

describe("deployment scripts", () => {
  test("cloudflare deploy publishes the patched worker directly with Wrangler", () => {
    expect(packageJson.scripts["cf:deploy"]).toContain("wrangler deploy .open-next/worker.js");
    expect(packageJson.scripts["cf:deploy"]).toContain("--config ops/infra/cloudflare/wrangler.jsonc");
    expect(packageJson.scripts["cf:deploy"]).toContain("--env=");
    expect(packageJson.scripts["cf:deploy"]).not.toContain("opennextjs-cloudflare deploy");
    expect(packageJson.scripts["cf:deploy"]).not.toContain("populateCache remote");
  });

  test("cloudflare cache population is explicit because R2 upload retries should not block deploys", () => {
    expect(packageJson.scripts["cf:cache:populate"]).toBe("opennextjs-cloudflare populateCache remote --cacheChunkSize 1");
  });
});
