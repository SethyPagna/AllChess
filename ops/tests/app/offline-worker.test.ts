import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";

const origin = "https://allchess.test";
const absolute = (value: string | Request) => new URL(typeof value === "string" ? value : value.url, origin).href;
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
type WorkerEvent = { request?: object; data?: object; ports?: object[]; waitUntil?: (promise: Promise<unknown>) => void; respondWith?: (response: Promise<Response>) => void };

function harness() {
  const stores = new Map<string, Map<string, Response>>();
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const network = new Map<string, string>();
  const hits: string[] = [];
  let online = true;
  const caches = {
    keys: async () => [...stores.keys()], has: async (name: string) => stores.has(name), delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name)!;
      return {
        keys: async () => [...entries.keys()].map(url => new Request(url)),
        put: async (key: string | Request, value: Response) => { entries.set(absolute(key), value.clone()); },
        match: async (key: string | Request) => entries.get(absolute(key))?.clone(),
        addAll: async (keys: string[]) => { keys.forEach(key => entries.set(absolute(key), new Response(key === "/offline.html" ? "Reconnect" : "icon"))); }
      };
    }
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: { addEventListener: (type: string, callback: (event: WorkerEvent) => void) => handlers.set(type, callback), location: { origin }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches, URL, Response, Request, Set, Map, AbortController, setTimeout, clearTimeout, crypto: webcrypto,
    fetch: async (request: string | Request) => {
      const path = new URL(absolute(request)).pathname; hits.push(path);
      if (!online) throw new Error("offline");
      return network.has(path) ? new Response(network.get(path)) : new Response("missing", { status: 404 });
    }
  });
  const lifecycle = (type: string) => new Promise(resolve => handlers.get(type)!({ waitUntil: promise => { void promise.then(resolve); } }));
  const message = async (type: string) => {
    const responses: Array<{ ready: boolean; error?: string; downloading?: boolean }> = [];
    let work: Promise<unknown> = Promise.resolve();
    handlers.get("message")!({ data: { type }, ports: [{ postMessage: (value: typeof responses[number]) => responses.push(value), close: () => {} }], waitUntil: promise => { work = promise; } });
    await work; return responses;
  };
  const request = async (path: string, mode = "navigate", method = "GET") => {
    let response: Promise<Response> | undefined;
    handlers.get("fetch")!({ request: { url: absolute(path), mode, method }, respondWith: value => { response = value; } });
    return response;
  };
  function manifest(version: string, shell = "Public board shell", extra: Array<{ url: string; value: string }> = []) {
    const values = [{ url: "/offline", value: shell }, { url: "/_next/static/chunks/board.123.js", value: "board code" }, ...extra];
    values.forEach(asset => network.set(asset.url, asset.value));
    network.set("/offline-pack.json", JSON.stringify({ version: sha(version), assets: values.map(asset => ({ url: asset.url, sha256: sha(asset.value), bytes: Buffer.byteLength(asset.value) })) }));
  }
  return { stores, network, hits, lifecycle, message, request, manifest, offline: () => { online = false; } };
}

describe("public offline play pack", () => {
  test("cold launch serves a complete shell, chunks, and local-only redirect without room secrets", async () => {
    const sw = harness(); await sw.lifecycle("install"); sw.manifest("first", "Public board shell", ["shogi", "xiangqi", "janggi", "makruk", "draughts", "konane"].map(game => ({ url: `/assets/${game}/collection.glb`, value: `${game} GLB` })));
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toEqual({ ready: true });
    sw.network.delete("/_next/static/chunks/board.123.js");
    expect(await (await sw.request("/_next/static/chunks/board.123.js", "cors"))!.text()).toBe("board code");
    sw.offline();
    expect(await (await sw.request("/offline?game=classic"))!.text()).toBe("Public board shell");
    expect(await (await sw.request("/_next/static/chunks/board.123.js?dpl=build123", "cors"))!.text()).toBe("board code");
    for (const game of ["shogi", "xiangqi", "janggi", "makruk", "draughts", "konane"]) expect(await (await sw.request(`/assets/${game}/collection.glb`, "cors"))!.text()).toBe(`${game} GLB`);
    const redirect = await sw.request("/km/play/ouk-chaktrang?mode=room&room=private&token=secret&time=rapid&resume=local-save");
    expect(redirect!.headers.get("location")).toBe(origin + "/offline?locale=km&game=ouk-chaktrang&time=rapid&resume=local-save");
    expect((await sw.message("OFFLINE_STATUS")).at(-1)).toEqual({ ready: true });
  });

  test("a corrupt update never replaces a usable download or leaves a partial pack", async () => {
    const sw = harness(); await sw.lifecycle("install"); sw.manifest("first"); await sw.message("DOWNLOAD_OFFLINE");
    sw.manifest("second", "new shell"); sw.network.set("/_next/static/chunks/board.123.js", "corrupt bytes");
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toMatchObject({ ready: true, error: expect.any(String) });
    expect([...sw.stores.keys()].filter(key => key.startsWith("allchess-play-pack-"))).toEqual(["allchess-play-pack-" + sha("first")]);
    sw.offline(); expect(await (await sw.request("/offline"))!.text()).toBe("Public board shell");
  });

  test("manifest cannot request account or API content; runtime never caches it", async () => {
    const sw = harness(); sw.manifest("unsafe", "shell", [{ url: "/api/friends/rooms/private", value: "secret" }]);
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toMatchObject({ ready: false, error: expect.any(String) });
    expect(sw.hits).not.toContain("/api/friends/rooms/private");
    expect(await sw.request("/api/friends/rooms/private", "cors")).toBeUndefined();
    expect(await sw.request("/en/profile/player?_rsc=secret", "cors")).toBeUndefined();
    expect(await sw.request("/offline", "navigate", "POST")).toBeUndefined();
  });

  test.each(["/_next/static/../../api/account.js", "/_next/static/%2e%2e/%2e%2e/api/account.js", "/_next/static/%2e%2e%2f%2e%2e%2fapi/account.js"])("rejects manifest path traversal: %s", async url => {
    const sw = harness(); sw.manifest("unsafe", "shell", [{ url, value: "private" }]);
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toMatchObject({ ready: false, error: expect.any(String) });
    expect(sw.hits).toEqual(["/offline-pack.json"]);
  });

  test("storage eviction reports unavailable and uses the small reconnect fallback", async () => {
    const sw = harness(); await sw.lifecycle("install"); sw.manifest("first"); await sw.message("DOWNLOAD_OFFLINE");
    sw.stores.delete("allchess-play-pack-" + sha("first")); sw.offline();
    expect((await sw.message("OFFLINE_STATUS")).at(-1)).toEqual({ ready: false });
    expect(await (await sw.request("/en"))!.text()).toBe("Reconnect");
  });

  test("simultaneous download requests share one job and same-version updates reuse the verified pack", async () => {
    const sw = harness(); sw.manifest("first");
    const results = await Promise.all([sw.message("DOWNLOAD_OFFLINE"), sw.message("DOWNLOAD_OFFLINE")]);
    expect(results.every(result => result.at(-1)?.ready)).toBe(true);
    expect(sw.hits.filter(path => path === "/offline")).toHaveLength(1);
    await sw.message("DOWNLOAD_OFFLINE");
    expect(sw.hits.filter(path => path === "/offline")).toHaveLength(1);
  });
});


test("the public web-app manifest remains readable after a cold offline request", async () => {
  const sw=harness(); sw.manifest("manifest", "Public board shell", [{url:"/manifest.webmanifest",value:'{"name":"AllChess","display":"standalone"}'}]);
  await sw.message("DOWNLOAD_OFFLINE");sw.offline();
  expect(await (await sw.request("/manifest.webmanifest", "cors"))?.text()).toBe('{"name":"AllChess","display":"standalone"}');
});
