import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";

const origin = "https://allchess.test";
const absolute = (value: string | Request) => new URL(typeof value === "string" ? value : value.url, origin).href;
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const offlinePackBudgetBytes = 88 * 1024 * 1024;
type PackManifest = { version: string; assets: Array<{ url: string; sha256: string; bytes: number }> };
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
    const responses: Array<{ ready: boolean; error?: string; downloading?: boolean; completed?: number; total?: number }> = [];
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

function rewriteManifest(sw: ReturnType<typeof harness>, mutate: (manifest: PackManifest) => void) {
  const manifest = JSON.parse(sw.network.get("/offline-pack.json")!) as PackManifest;
  mutate(manifest);
  sw.network.set("/offline-pack.json", JSON.stringify(manifest));
}

async function updateHarness() {
  const sw = harness();
  sw.manifest("previous", "Previously verified shell");
  expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toEqual({ ready: true });
  sw.hits.length = 0;
  sw.manifest("replacement", "Replacement shell");
  return sw;
}

async function expectPreviousPack(sw: ReturnType<typeof harness>) {
  expect([...sw.stores.keys()].filter(key => key.startsWith("allchess-play-pack-"))).toEqual(["allchess-play-pack-" + sha("previous")]);
  expect((await sw.message("OFFLINE_STATUS")).at(-1)).toEqual({ ready: true });
  sw.offline();
  expect(await (await sw.request("/offline"))!.text()).toBe("Previously verified shell");
}

describe("public offline play pack", () => {
  test("downloads every photographic piece and PBR material and serves it after disconnecting", async () => {
    const urls = ["/assets/classic/marble.glb", "/assets/khmer/atelier.glb", "/assets/khmer/courtyard.glb", "/assets/draughts/rosette.glb", "/assets/draughts/club.glb", "/assets/shogi/hori.glb"];
    urls.push("/assets/shogi/hori/board-colour.webp");
    urls.push("/assets/xiangqi/celadon.glb", "/assets/xiangqi/celadon/board-colour.webp");
    urls.push("/assets/konane/shore.glb", "/assets/konane/shore/light-stone.webp", "/assets/konane/shore/dark-stone.webp", "/assets/konane/shore/board-colour.webp");
    for (const side of ["red", "black"]) for (const name of ["general", "advisor", "elephant", "horse", "chariot", "cannon", "soldier"]) urls.push(`/assets/xiangqi/celadon/${side}-${name}.webp`);
    for (const face of ["king-jewel", "king", "rook", "bishop", "gold", "silver", "knight", "lance", "pawn", "promoted-rook", "promoted-bishop", "promoted-silver", "promoted-knight", "promoted-lance", "promoted-pawn"]) urls.push(`/assets/shogi/hori/${face}.webp`);
    for (const side of ["light", "dark"]) {
      for (const name of ["king", "queen", "bishop", "knight", "rook", "pawn"]) urls.push(`/assets/classic/marble/${side}_${name}.png`);
      for (const set of ["atelier", "courtyard"]) for (const name of ["king", "queen", "bishop", "horse", "rook", "pawn"]) urls.push(`/assets/khmer/${set}/${side}-${name}.webp`);
      for (const set of ["rosette", "club"]) for (const name of ["man", "king"]) urls.push(`/assets/draughts/${set}/${side}-${name}.webp`);
    }
    for (const name of ["colour", "normal", "roughness"]) urls.push(`/assets/materials/wood-table/${name}.jpg`);
    urls.push("/assets/materials/studio-room.hdr");
    const sw = harness();
    await sw.lifecycle("install");
    sw.manifest("photographic", "Public shell", urls.map(url => ({ url, value: `bytes:${url}` })));
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toEqual({ ready: true });
    sw.offline();
    for (const url of urls) expect(await (await sw.request(url, "cors"))!.text()).toBe(`bytes:${url}`);
  });

  test("cold launch serves a complete shell, chunks, and local-only redirect without room secrets", async () => {
    const sw = harness(); await sw.lifecycle("install"); sw.manifest("first", "Public board shell", ["shogi", "xiangqi", "janggi", "makruk", "draughts", "konane", "shatranj", "chaturanga", "jungle"].map(game => ({ url: `/assets/${game}/collection.glb`, value: `${game} GLB` })));
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toEqual({ ready: true });
    sw.network.delete("/_next/static/chunks/board.123.js");
    expect(await (await sw.request("/_next/static/chunks/board.123.js", "cors"))!.text()).toBe("board code");
    sw.offline();
    expect(await (await sw.request("/offline?game=classic"))!.text()).toBe("Public board shell");
    expect(await (await sw.request("/_next/static/chunks/board.123.js?dpl=build123", "cors"))!.text()).toBe("board code");
    for (const game of ["shogi", "xiangqi", "janggi", "makruk", "draughts", "konane", "shatranj", "chaturanga", "jungle"]) expect(await (await sw.request(`/assets/${game}/collection.glb`, "cors"))!.text()).toBe(`${game} GLB`);
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

  test("the exact byte budget reaches content verification without allocating a budget-sized body", async () => {
    const sw = await updateHarness();
    rewriteManifest(sw, manifest => { manifest.assets[0].bytes = offlinePackBudgetBytes - manifest.assets[1].bytes; });
    const messages = await sw.message("DOWNLOAD_OFFLINE");
    expect(messages).toContainEqual({ ready: true, downloading: true, completed: 0, total: offlinePackBudgetBytes });
    expect(sw.hits).toEqual(expect.arrayContaining(["/offline-pack.json", "/offline", "/_next/static/chunks/board.123.js"]));
    // The tiny response deliberately fails its advertised size: admission is not a verified download.
    expect(messages.at(-1)).toMatchObject({ ready: true, error: "The app changed during download. Please try again." });
    await expectPreviousPack(sw);
  });

  test("one byte beyond the budget is rejected before asset fetches or replacement of the prior pack", async () => {
    const sw = await updateHarness();
    rewriteManifest(sw, manifest => { manifest.assets[0].bytes = offlinePackBudgetBytes + 1 - manifest.assets[1].bytes; });
    const messages = await sw.message("DOWNLOAD_OFFLINE");
    expect(messages.some(message => message.downloading)).toBe(false);
    expect(messages.at(-1)).toMatchObject({ ready: true, error: "The play pack is too large. Please try again after the app updates." });
    expect(sw.hits).toEqual(["/offline-pack.json"]);
    await expectPreviousPack(sw);
  });

  test.each([0, -1, .5, Number.MAX_SAFE_INTEGER + 1, null, "1"])("rejects invalid advertised asset bytes %s before fetching assets", async bytes => {
    const sw = await updateHarness();
    rewriteManifest(sw, manifest => { manifest.assets[1].bytes = bytes as number; });
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toMatchObject({ ready: true, error: "The play pack could not be verified. Try again after the app updates." });
    expect(sw.hits).toEqual(["/offline-pack.json"]);
    await expectPreviousPack(sw);
  });

  test.each([
    { label: "empty asset list", mutate: (manifest: PackManifest) => { manifest.assets = []; } },
    { label: "missing public shell", mutate: (manifest: PackManifest) => { manifest.assets = manifest.assets.filter(asset => asset.url !== "/offline"); } },
    { label: "duplicate path", mutate: (manifest: PackManifest) => { manifest.assets.push({ ...manifest.assets[0] }); } },
    { label: "1001 assets", mutate: (manifest: PackManifest) => { manifest.assets = Array.from({ length: 1001 }, (_, index) => ({ url: index ? `/_next/static/chunks/part-${index}.js` : "/offline", bytes: 1, sha256: sha("x") })); } },
    { label: "invalid version digest", mutate: (manifest: PackManifest) => { manifest.version = "not-a-build-digest"; } }
  ])("rejects a manifest with $label before any asset fetch and retains the prior pack", async ({ mutate }) => {
    const sw = await updateHarness();
    rewriteManifest(sw, mutate);
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toMatchObject({ ready: true, error: "The play pack could not be verified. Try again after the app updates." });
    expect(sw.hits).toEqual(["/offline-pack.json"]);
    await expectPreviousPack(sw);
  });

  test.each([-1, 1])("a body size differing from its declared length by %s byte removes staging and retains the prior pack", async delta => {
    const sw = await updateHarness();
    // Keep the actual body hash correct to independently exercise the byte-count guard.
    rewriteManifest(sw, manifest => { manifest.assets[1].bytes += delta; });
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toMatchObject({ ready: true, error: "The app changed during download. Please try again." });
    expect(sw.hits).toContain("/_next/static/chunks/board.123.js");
    await expectPreviousPack(sw);
  });

  test.each(["/assets/shogi/hori/promoted-king.webp", "/assets/shogi/hori/promoted-gold.webp", "/assets/shogi/hori/unknown.webp", "/assets/xiangqi/hori.glb"])("rejects assets outside the native Hori contract: %s", async url => {
    const sw = harness(); sw.manifest("invalid-hori", "shell", [{ url, value: "invalid asset" }]);
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toMatchObject({ ready: false, error: expect.any(String) });
    expect(sw.hits).toEqual(["/offline-pack.json"]);
  });

  test.each(["/_next/static/../../api/account.js", "/_next/static/%2e%2e/%2e%2e/api/account.js", "/_next/static/%2e%2e%2f%2e%2e%2fapi/account.js"])("rejects manifest path traversal: %s", async url => {
    const sw = harness(); sw.manifest("unsafe", "shell", [{ url, value: "private" }]);
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toMatchObject({ ready: false, error: expect.any(String) });
    expect(sw.hits).toEqual(["/offline-pack.json"]);
  });

  test.each(["/assets/xiangqi/celadon/light-general.webp", "/assets/xiangqi/celadon/black-rook.webp", "/assets/xiangqi/celadon/red-promoted-soldier.webp", "/assets/xiangqi/celadon/board-normal.webp", "/assets/janggi/celadon.glb"])("rejects assets outside the native Celadon contract: %s", async url => {
    const sw = harness(); sw.manifest("invalid-celadon", "shell", [{ url, value: "invalid asset" }]);
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toMatchObject({ ready: false, error: expect.any(String) });
    expect(sw.hits).toEqual(["/offline-pack.json"]);
  });

  test("rejects an unlisted studio environment before fetching assets", async () => {
    const sw = harness(); sw.manifest("unlisted-environment", "shell", [{ url: "/assets/materials/private.hdr", value: "private" }]);
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)).toMatchObject({ ready: false, error: expect.any(String) });
    expect(sw.hits).toEqual(["/offline-pack.json"]);
  });

  test.each(["/assets/konane/shore/source.json", "/assets/konane/shore/light-stone.png", "/assets/konane/shore/king.webp", "/assets/konane/shore/board-normal.webp", "/assets/shogi/shore.glb"])("rejects assets outside the Shore runtime contract: %s", async url => {
    const sw = await updateHarness();
    sw.manifest("invalid-shore", "shell", [{ url, value: "unlisted" }]);
    expect((await sw.message("DOWNLOAD_OFFLINE")).at(-1)?.error).toContain("could not be verified");
    expect(sw.hits).toEqual(["/offline-pack.json"]);
    await expectPreviousPack(sw);
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
