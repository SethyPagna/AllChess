import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

type HtmlHandling = "auto-trailing-slash" | "force-trailing-slash" | "drop-trailing-slash" | "none";

const configFiles = ["wrangler.jsonc", "ops/infra/cloudflare/wrangler.jsonc"];
const tempRoot = path.resolve(tmpdir());
const fixturePrefix = "allchess-offline-routing-";
const shell = Buffer.from("<!doctype html><title>Offline play</title><main>Public play shell</main>");
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
let fixture: string;
let fallback: Buffer;
let worker: Miniflare | undefined;

beforeAll(async () => {
  fixture = await mkdtemp(path.join(tempRoot, fixturePrefix));
  fallback = await readFile(path.join(process.cwd(), "public/offline.html"));
  await writeFile(path.join(fixture, "offline.html"), fallback);
});

afterEach(async () => {
  await worker?.dispose();
  worker = undefined;
});

afterAll(async () => {
  if (fixture && path.dirname(path.resolve(fixture)) === tempRoot && path.basename(fixture).startsWith(fixturePrefix)) {
    await rm(fixture, { recursive: true, force: true });
  }
});

function routeAssets(htmlHandling?: HtmlHandling) {
  worker = new Miniflare({
    name: "offline-routing-test",
    modules: true,
    script: `export default {
      fetch(request) {
        return new URL(request.url).pathname === "/offline"
          ? new Response(${JSON.stringify(shell.toString())}, { headers: { "content-type": "text/html" } })
          : new Response("Not found", { status: 404 });
      }
    };`,
    compatibilityDate: "2026-05-13",
    assets: {
      workerName: "offline-routing-test",
      directory: fixture,
      binding: "ASSETS",
      routerConfig: { has_user_worker: true },
      assetConfig: { html_handling: htmlHandling }
    }
  });
  return worker;
}

test.each(configFiles)("%s keeps the offline play shell separate from the reconnect fallback", async (file) => {
  const config = JSON.parse(await readFile(path.join(process.cwd(), file), "utf8")) as { assets: { html_handling?: HtmlHandling } };
  const local = routeAssets(config.assets.html_handling);

  for (const route of ["/offline", "/offline?game=classic"]) {
    const response = await local.dispatchFetch(`https://allchess.test${route}`, { redirect: "manual" });
    expect(response.status).toBe(200);
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.length).toBe(shell.length);
    expect(sha256(body)).toBe(sha256(shell));
    expect(sha256(body)).not.toBe(sha256(fallback));
  }

  const response = await local.dispatchFetch("https://allchess.test/offline.html", { redirect: "manual" });
  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
  expect(Buffer.from(await response.arrayBuffer())).toEqual(fallback);
});

test("omitting HTML handling reproduces the clean-URL collision and fallback redirect", async () => {
  const local = routeAssets();
  const response = await local.dispatchFetch("https://allchess.test/offline", { redirect: "manual" });
  expect(response.status).toBe(200);
  const body = Buffer.from(await response.arrayBuffer());
  expect(body).toEqual(fallback);
  expect(sha256(body)).not.toBe(sha256(shell));

  const redirected = await local.dispatchFetch("https://allchess.test/offline.html", { redirect: "manual" });
  expect(redirected.status).toBe(307);
  expect(new URL(redirected.headers.get("location")!, "https://allchess.test").pathname).toBe("/offline");
});
