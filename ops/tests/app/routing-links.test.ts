import { describe, expect, test } from "vitest";

import { analysisPlyHref } from "@/lib/routing/analysis-links";
import { watchHref } from "@/lib/routing/watch-links";

describe("route link helpers", () => {
  test("builds watch filter links without default query clutter", () => {
    expect(watchHref("en", { q: "", status: "all", sort: "recent" })).toBe("/en/watch");
    expect(watchHref("en", { q: "rapid", status: "active", sort: "spectators" })).toBe("/en/watch?q=rapid&status=active&sort=spectators");
    expect(watchHref("en", { q: "mini-shogi-local", variant: "mini-shogi" })).toBe("/en/watch?q=mini-shogi-local&variant=mini-shogi");
  });

  test("encodes analysis game ids and preserves autoplay", () => {
    expect(analysisPlyHref("en", "game one", 3)).toBe("/en/analysis/game%20one?ply=3");
    expect(analysisPlyHref("en", "game/one", 4, { autoplay: true })).toBe("/en/analysis/game%2Fone?ply=4&autoplay=1");
  });
});
