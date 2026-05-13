import { describe, expect, test } from "vitest";

import { createDefaultStats } from "@/lib/stats";
import { timeControls } from "@/lib/time-controls";
import { formatClock, tickGameClock } from "@/lib/clocks";
import { createInitialState } from "@/lib/variants";
import { localizePath } from "@/lib/i18n/navigation";

describe("navigation helpers", () => {
  test("keeps the current route when switching languages", () => {
    expect(localizePath("/en/play/classic?bot=normal", "km")).toBe("/km/play/classic?bot=normal");
    expect(localizePath("/settings", "fr")).toBe("/fr/settings");
  });
});

describe("time controls", () => {
  test("includes standard speed modes for chess variants", () => {
    expect(timeControls.map((control) => control.key)).toEqual(["bullet", "blitz", "rapid", "classical", "correspondence", "freestyle"]);
    expect(timeControls.find((control) => control.key === "blitz")).toMatchObject({ baseSeconds: 300, incrementSeconds: 0 });
  });

  test("ticks the active player clock and flags on timeout", () => {
    const state = createInitialState("classic", "clock-test");
    state.clocks = state.clocks.map((clock) => (clock.color === "white" ? { ...clock, remainingMs: 900 } : clock));

    const next = tickGameClock(state, 1000);

    expect(next.clocks.find((clock) => clock.color === "white")?.remainingMs).toBe(0);
    expect(next.status).toBe("completed");
    expect(next.result).toBe("black");
  });

  test("formats chess clocks compactly", () => {
    expect(formatClock(65_000)).toBe("1:05");
    expect(formatClock(0)).toBe("∞");
  });
});

describe("site statistics", () => {
  test("uses honest live-data counts instead of fake player counts", () => {
    const stats = createDefaultStats();

    expect(stats.playersOnline.value).toBe("0");
    expect(stats.activeRooms.value).toBe("0");
    expect(stats.spectators.value).toBe("0");
    expect(Number(stats.variants.value)).toBeGreaterThan(11);
    expect(stats.playersOnline.isEstimated).toBe(false);
  });
});
