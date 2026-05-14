import { describe, expect, test } from "vitest";

import { GET as catalogGet } from "@/app/api/catalog/route";
import { GET as catalogItemGet } from "@/app/api/catalog/[gameId]/route";
import { GET as familiesGet } from "@/app/api/game-families/route";
import { GET as leaderboardsGet } from "@/app/api/leaderboards/route";
import { GET as rulesGet } from "@/app/api/rules/[variantKey]/route";
import { displayGameName, gameCatalog, gameFamilies, getCatalogStats, getGameCatalogEntry, getPlayableGameVerification, searchGameCatalog } from "@/lib/catalog";

describe("universal game catalog", () => {
  test("keeps every current playable variant in the broader catalog", () => {
    const playableIds = gameCatalog.filter((entry) => entry.playability === "playable").map((entry) => entry.id).sort();

    expect(playableIds).toEqual(["chess960", "classic", "king-of-the-hill", "three-check", "xiangqi"]);
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
      rulesComplete: false,
      knownGaps: expect.arrayContaining([expect.stringContaining("drops")])
    });
    expect(getGameCatalogEntry("shogi")).toMatchObject({ playability: "learn" });
    expect(getGameCatalogEntry("jungle")).toMatchObject({ playability: "learn" });
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
    expect(stats.playableGames).toBe(5);
    expect(stats.familyCounts.mancala).toBeGreaterThan(0);

    const catalog = await catalogGet(new Request("http://allchess.test/api/catalog?q=go"));
    await expect(catalog.json()).resolves.toMatchObject({ stats: { totalGames: expect.any(Number) } });

    const item = await catalogItemGet(new Request("http://allchess.test/api/catalog/dou-shou-qi"), { params: Promise.resolve({ gameId: "dou-shou-qi" }) });
    await expect(item.json()).resolves.toMatchObject({ id: "jungle", name: { native: "鬥獸棋" } });

    const families = await familiesGet();
    await expect(families.json()).resolves.toMatchObject({ families: expect.arrayContaining([expect.objectContaining({ key: "mancala", games: expect.any(Number) })]) });

    const leaderboards = await leaderboardsGet();
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
});
