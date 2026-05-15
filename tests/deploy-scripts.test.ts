import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };

describe("deployment scripts", () => {
  test("cloudflare deploy populates OpenNext cache then publishes the patched worker with Wrangler", () => {
    expect(packageJson.scripts["cf:deploy"]).toContain("opennextjs-cloudflare populateCache remote --cacheChunkSize 1");
    expect(packageJson.scripts["cf:deploy"]).toContain("wrangler deploy --env=");
    expect(packageJson.scripts["cf:deploy"]).not.toContain("opennextjs-cloudflare deploy");
  });
});
