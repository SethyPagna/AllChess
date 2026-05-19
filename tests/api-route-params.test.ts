import { describe, expect, test } from "vitest";

import { parseBoundedInteger, parseCatalogFamily, parsePlayabilityStatus, safeDecodeRouteSegment } from "@/lib/api/route-params";

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

});
