import { describe, expect, test } from "vitest";

import { NextRequest } from "next/server";

import { parseBoundedInteger, parseCatalogFamily, parsePlayabilityStatus, safeDecodeRouteSegment } from "@/lib/api/route-params";
import { proxy } from "@/proxy";

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

  test("proxy returns a clean API 404 for malformed encoded paths", async () => {
    const response = proxy(new NextRequest("http://allchess.test/api/catalog/%E0%A4%A"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Unknown route." });
  });
});
