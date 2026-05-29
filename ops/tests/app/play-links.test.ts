import { describe, expect, test } from "vitest";

import { playGameHref, playSetupHref } from "@/lib/routing/play-links";

describe("play link helpers", () => {
  test("keeps setup links on the chosen mode and clock", () => {
    expect(playSetupHref("en", { mode: "bot", time: "blitz" })).toBe("/en/play?mode=bot&time=blitz");
    expect(playSetupHref("en", { mode: "room", time: "classical" })).toBe("/en/play?mode=room&time=classical");
  });

  test("routes spectate setup and games to the watch surface", () => {
    expect(playSetupHref("en", { mode: "spectate", time: "rapid" })).toBe("/en/watch");
    expect(playGameHref("en", "classic", { mode: "spectate", time: "rapid" })).toBe("/en/watch");
  });

  test("keeps bot game links explicit and clocked", () => {
    expect(playGameHref("en", "classic", { mode: "bot", time: "blitz" })).toBe("/en/play/classic?bot=normal&mode=bot&time=blitz");
    expect(playGameHref("en", "classic", { bot: true, time: "rapid" })).toBe("/en/play/classic?bot=normal&mode=bot&time=rapid");
  });

  test("falls back to setup when a game key is missing", () => {
    expect(playGameHref("en", undefined, { mode: "room", time: "classical" })).toBe("/en/play?mode=room&time=classical");
  });

  test("defaults direct games to local rapid instead of silently starting online", () => {
    expect(playGameHref("en", "classic")).toBe("/en/play/classic?mode=offline&time=rapid");
  });
});
