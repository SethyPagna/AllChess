import { describe, expect, test } from "vitest";

import { GET as catalogGet } from "@/app/api/catalog/route";
import { GET as catalogItemGet } from "@/app/api/catalog/[gameId]/route";
import { GET as familiesGet } from "@/app/api/game-families/route";
import { GET as leaderboardsGet } from "@/app/api/leaderboards/route";
import { GET as rulesGet } from "@/app/api/rules/[variantKey]/route";
import {
  displayGameName,
  displayModeReadiness,
  displayReleaseReadiness,
  gameCatalog,
  gameFamilies,
  getCatalogReleaseReadiness,
  getCatalogModeSupport,
  getCatalogSupportedModes,
  getCatalogStats,
  getGameCatalogEntry,
  getPlayableGameVerification,
  filterGameCatalogEntries,
  searchGameCatalog
} from "@/lib/catalog";

describe("universal game catalog", () => {
  test("keeps every current playable variant in the broader catalog", () => {
    const playableIds = gameCatalog.filter((entry) => entry.playability === "playable").map((entry) => entry.id).sort();

    expect(playableIds).toEqual([
      "antichess",
      "chess960",
      "classic",
      "crazyhouse",
      "horde",
      "janggi",
      "jungle",
      "king-of-the-hill",
      "makruk",
      "mini-shogi",
      "racing-kings",
      "shatranj",
      "shogi",
      "three-check",
      "xiangqi"
    ]);
    expect(gameCatalog.find((entry) => entry.id === "classic")).toMatchObject({
      piecePresentation: "staunton-svg",
      botAdapter: "fairy-stockfish"
    });
  });

  test("only marks games playable when the verification matrix is complete", () => {
    const playableEntries = gameCatalog.filter((entry) => entry.playability === "playable");

    for (const entry of playableEntries) {
      expect(entry.verification).toMatchObject({
        rulesComplete: true,
        botComplete: true,
        reviewComplete: true,
        persistenceComplete: true,
        e2eComplete: true,
        knownGaps: []
      });
    }

    expect(getPlayableGameVerification("shogi")).toMatchObject({
      rulesComplete: true,
      knownGaps: []
    });
    expect(getGameCatalogEntry("shogi")).toMatchObject({ playability: "playable" });
    expect(getGameCatalogEntry("mini-shogi")).toMatchObject({ playability: "playable", botAdapter: "internal-search" });
    expect(getGameCatalogEntry("crazyhouse")).toMatchObject({ playability: "playable", botAdapter: "internal-search" });
    expect(getGameCatalogEntry("shatranj")).toMatchObject({ playability: "playable", botAdapter: "internal-search" });
    expect(getGameCatalogEntry("janggi")).toMatchObject({ playability: "playable" });
    expect(getGameCatalogEntry("jungle")).toMatchObject({ playability: "playable" });
    expect(getGameCatalogEntry("racing-kings")).toMatchObject({ playability: "playable", botAdapter: "internal-search" });
    expect(displayReleaseReadiness(getGameCatalogEntry("classic")!)).toBe("Verified ready");
    expect(displayReleaseReadiness(getGameCatalogEntry("shogi")!)).toBe("Verified ready");
    expect(getCatalogReleaseReadiness(getGameCatalogEntry("classic")!)).toMatchObject({ status: "verified-ready", gateComplete: true, blockers: [] });
    expect(getCatalogReleaseReadiness(getGameCatalogEntry("shogi")!)).toMatchObject({
      status: "verified-ready",
      gateComplete: true,
      blockers: []
    });
  });

  test("models play-mode support separately from verified release readiness", () => {
    const classic = getGameCatalogEntry("classic");
    const shogi = getGameCatalogEntry("shogi");
    const go = getGameCatalogEntry("go-19x19");
    if (!classic || !shogi || !go) throw new Error("Expected catalog fixtures.");

    expect(getCatalogModeSupport(classic, "online")).toMatchObject({ enabled: true, level: "verified" });
    expect(getCatalogModeSupport(classic, "bot")).toMatchObject({ enabled: true, level: "verified" });
    expect(getCatalogModeSupport(shogi, "bot")).toMatchObject({ enabled: true, level: "verified" });
    expect(getCatalogModeSupport(shogi, "offline")).toMatchObject({ enabled: true, level: "verified" });
    expect(getCatalogModeSupport(shogi, "online")).toMatchObject({ enabled: true, level: "verified" });
    expect(getCatalogModeSupport(go, "bot")).toMatchObject({ enabled: false, level: "guide-only" });
    expect(getCatalogSupportedModes(shogi).map((support) => support.mode)).toEqual(expect.arrayContaining(["bot", "offline", "spectate"]));
    expect(displayModeReadiness(shogi, "bot")).toBe("Bot ready");
    expect(filterGameCatalogEntries(gameCatalog, "", { mode: "bot" }).map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["classic", "crazyhouse", "shatranj", "shogi", "mini-shogi", "janggi", "makruk", "jungle"])
    );
    expect(filterGameCatalogEntries(gameCatalog, "", { mode: "online" }).map((entry) => entry.id).sort()).toEqual([
      "antichess",
      "chess960",
      "classic",
      "crazyhouse",
      "horde",
      "janggi",
      "jungle",
      "king-of-the-hill",
      "makruk",
      "mini-shogi",
      "racing-kings",
      "shatranj",
      "shogi",
      "three-check",
      "xiangqi"
    ]);
  });

  test("covers the wider board-game families without marking unfinished engines playable", () => {
    expect(gameFamilies.map((family) => family.key)).toEqual([
      "chess-family",
      "asian-chess",
      "draughts",
      "mancala",
      "go-family",
      "tables",
      "tafl",
      "race",
      "mill",
      "regional"
    ]);
    expect(getGameCatalogEntry("oware")).toMatchObject({ family: "mancala", playability: "coming-soon" });
    expect(getGameCatalogEntry("go-19x19")).toMatchObject({ family: "go-family", piecePresentation: "go-stones" });
    expect(getGameCatalogEntry("backgammon")).toMatchObject({ family: "tables", piecePresentation: "backgammon-checkers" });
    expect(getGameCatalogEntry("hnefatafl")).toMatchObject({ family: "tafl", piecePresentation: "tafl-runes" });
    expect(getGameCatalogEntry("nine-mens-morris")).toMatchObject({ family: "mill", piecePresentation: "mill-stones" });
  });

  test("searches by English, native, romanized, and alias names", () => {
    const jungle = getGameCatalogEntry("Dòu Shòu Qí");
    expect(jungle).toMatchObject({ id: "jungle", variantKey: "jungle" });
    expect(displayGameName(jungle!)).toBe("Jungle / Dòu Shòu Qí / 鬥獸棋");
    expect(searchGameCatalog("hawaiian checkers").map((entry) => entry.id)).toContain("konane");
    expect(searchGameCatalog("윷놀이").map((entry) => entry.id)).toContain("yut-nori");
  });

  test("stats and API payloads are real catalog counts, not fake live-player estimates", async () => {
    const stats = getCatalogStats();
    expect(stats.totalGames).toBe(gameCatalog.length);
    expect(stats.playableGames).toBe(15);
    expect(stats.familyCounts.mancala).toBeGreaterThan(0);

    const catalog = await catalogGet(new Request("http://allchess.test/api/catalog?q=go"));
    await expect(catalog.json()).resolves.toMatchObject({
      stats: { totalGames: expect.any(Number) },
      entries: expect.arrayContaining([
        expect.objectContaining({
          releaseReadiness: expect.objectContaining({ status: expect.any(String), gateComplete: false })
        })
      ])
    });

    const botFilteredCatalog = await catalogGet(new Request("http://allchess.test/api/catalog?mode=bot&q=shogi"));
    await expect(botFilteredCatalog.json()).resolves.toMatchObject({
      entries: expect.arrayContaining([expect.objectContaining({ id: "shogi" }), expect.objectContaining({ id: "mini-shogi" })])
    });

    const invalidFilteredCatalog = await catalogGet(new Request("http://allchess.test/api/catalog?family=bad&playability=broken&mode=broken"));
    await expect(invalidFilteredCatalog.json()).resolves.toMatchObject({
      stats: { totalGames: gameCatalog.length }
    });

    const item = await catalogItemGet(new Request("http://allchess.test/api/catalog/dou-shou-qi"), { params: Promise.resolve({ gameId: "dou-shou-qi" }) });
    await expect(item.json()).resolves.toMatchObject({ id: "jungle", name: { native: "鬥獸棋" } });

    const gatedItem = await catalogItemGet(new Request("http://allchess.test/api/catalog/shogi"), { params: Promise.resolve({ gameId: "shogi" }) });
    await expect(gatedItem.json()).resolves.toMatchObject({
      id: "shogi",
      releaseReadiness: { status: "verified-ready", label: "Verified ready", gateComplete: true }
    });

    const families = await familiesGet();
    await expect(families.json()).resolves.toMatchObject({
      families: expect.arrayContaining([
        expect.objectContaining({ key: "mancala", games: stats.familyCounts.mancala }),
        expect.objectContaining({ key: "chess-family", games: stats.familyCounts["chess-family"] })
      ])
    });

    const leaderboards = await leaderboardsGet(new Request("http://allchess.test/api/leaderboards"));
    await expect(leaderboards.json()).resolves.toMatchObject({ source: "empty-live-data", leaderboards: [] });
  });

  test("rules API supports catalog game ids that are not playable yet", async () => {
    const response = await rulesGet(new Request("http://allchess.test/api/rules/oware"), { params: Promise.resolve({ variantKey: "oware" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      variantKey: "oware",
      numberedBasics: expect.arrayContaining([expect.stringContaining("Sow seeds")])
    });
  });

  test("catalog and rules APIs return clean 404s for malformed route ids", async () => {
    const catalogItem = await catalogItemGet(new Request("http://allchess.test/api/catalog/%E0%A4%A"), { params: Promise.resolve({ gameId: "%E0%A4%A" }) });
    const rules = await rulesGet(new Request("http://allchess.test/api/rules/%E0%A4%A"), { params: Promise.resolve({ variantKey: "%E0%A4%A" }) });

    expect(catalogItem.status).toBe(404);
    expect(rules.status).toBe(404);
  });
});
