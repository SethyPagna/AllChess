import { describe, expect, test } from "vitest";

import { parseBotDifficulty, parseBoundedInteger, parseCatalogFamily, parsePlayabilityStatus, parsePlayMode, parseQueryFlag, safeDecodeRouteSegment } from "@/lib/routing/params";

describe("API route parameter guards", () => {
  test("parses only known catalog filters", () => {
    expect(parseCatalogFamily("mancala")).toBe("mancala");
    expect(parseCatalogFamily("bad")).toBeUndefined();
    expect(parsePlayabilityStatus("learn")).toBe("learn");
    expect(parsePlayabilityStatus("broken")).toBeUndefined();
  });

  test("decodes route segments and clamps numeric limits", () => {
    expect(safeDecodeRouteSegment("profile%201")).toBe("profile 1");
    expect(safeDecodeRouteSegment("%E0%A4%A")).toBeNull();
    expect(parseBoundedInteger("999", 20, { min: 1, max: 100 })).toBe(100);
    expect(parseBoundedInteger("bad", 20, { min: 1, max: 100 })).toBe(20);
  });

  test("parses play modes and bot query flags narrowly", () => {
    expect(parsePlayMode("bot")).toBe("bot");
    expect(parsePlayMode(["spectate", "bot"])).toBe("spectate");
    expect(parsePlayMode("broken", "online")).toBe("online");
    expect(parseBotDifficulty("normal")).toBe("normal");
    expect(parseBotDifficulty("grandmaster")).toBe("grandmaster");
    expect(parseBotDifficulty("broken", "normal")).toBe("normal");
    expect(parseQueryFlag("true")).toBe(true);
    expect(parseQueryFlag("0")).toBe(false);
    expect(parseQueryFlag(["yes", "0"])).toBe(true);
  });
});
