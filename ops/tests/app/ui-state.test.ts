import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { ThemeProvider } from "@/components/shell/theme-provider";
import { createDefaultStats } from "@/lib/realtime/stats";
import { timeControls } from "@/lib/game/time-controls";
import { applyBotMoveAfterThinking, settleBotThinkingSnapshot } from "@/lib/game/bot-clock";
import { formatClock, settleTurnClockElapsed, tickGameClock } from "@/lib/game/clocks";
import { pushTimeline, redoTimeline, undoTimeline } from "@/lib/game/history";
import { createInitialState } from "@/lib/variants";
import { localizePath } from "@/lib/i18n/navigation";

describe("navigation helpers", () => {
  test("keeps the current route when switching languages", () => {
    expect(localizePath("/en/play/classic?bot=normal", "km")).toBe("/km/play/classic?bot=normal");
    expect(localizePath("/settings", "fr")).toBe("/fr/settings");
  });

  test("preserves query strings and hash fragments when switching languages", () => {
    expect(localizePath("/en/variants?playability=learn&q=Dou+Shou+Qi#catalog", "ja")).toBe("/ja/variants?playability=learn&q=Dou+Shou+Qi#catalog");
    expect(localizePath("play/classic?mode=bot#board", "de")).toBe("/de/play/classic?mode=bot#board");
    expect(localizePath("/fr/login?error=auth-error", "en")).toBe("/en/login?error=auth-error");
  });
});

describe("time controls", () => {
  test("includes standard speed modes for chess variants", () => {
    expect(timeControls.map((control) => control.key)).toEqual(["bullet", "blitz", "rapid", "classical", "correspondence", "freestyle"]);
    expect(timeControls.find((control) => control.key === "blitz")).toMatchObject({ baseSeconds: 300, incrementSeconds: 0 });
    expect(timeControls.find((control) => control.key === "rapid")).toMatchObject({ baseSeconds: 600, incrementSeconds: 0, label: "Rapid 10+0" });
  });

  test("ticks the active player clock and flags on timeout", () => {
    const state = createInitialState("classic", "clock-test");
    state.clocks = state.clocks.map((clock) => (clock.color === "white" ? { ...clock, remainingMs: 900 } : clock));

    const next = tickGameClock(state, 1000);

    expect(next.clocks.find((clock) => clock.color === "white")?.remainingMs).toBe(0);
    expect(next.status).toBe("completed");
    expect(next.result).toBe("black");
  });

  test("settles missed bot thinking time before applying a move", () => {
    const snapshot = createInitialState("classic", "bot-clock-settle");
    snapshot.clocks = snapshot.clocks.map((clock) => (clock.color === "white" ? { ...clock, remainingMs: 10_000 } : clock));
    const current = {
      ...snapshot,
      clocks: snapshot.clocks.map((clock) => (clock.color === "white" ? { ...clock, remainingMs: 9_800 } : clock))
    };

    const next = settleTurnClockElapsed(current, snapshot, 1_700);

    expect(next.clocks.find((clock) => clock.color === "white")?.remainingMs).toBe(8_300);
  });

  test("does not add time back if the live interval already charged more thinking time", () => {
    const snapshot = createInitialState("classic", "bot-clock-no-refund");
    snapshot.clocks = snapshot.clocks.map((clock) => (clock.color === "white" ? { ...clock, remainingMs: 10_000 } : clock));
    const current = {
      ...snapshot,
      clocks: snapshot.clocks.map((clock) => (clock.color === "white" ? { ...clock, remainingMs: 8_000 } : clock))
    };

    const next = settleTurnClockElapsed(current, snapshot, 1_000);

    expect(next.clocks.find((clock) => clock.color === "white")?.remainingMs).toBe(8_000);
  });

  test("flags timeout if bot thinking consumes the active clock", () => {
    const snapshot = createInitialState("classic", "bot-clock-timeout");
    snapshot.clocks = snapshot.clocks.map((clock) => (clock.color === "white" ? { ...clock, remainingMs: 900 } : clock));

    const next = settleTurnClockElapsed(snapshot, snapshot, 1_200);

    expect(next.status).toBe("completed");
    expect(next.outcomeReason).toBe("timeout");
    expect(next.result).toBe("black");
  });

  test("records bot thinking time in the history snapshot before the move", () => {
    const snapshot = createInitialState("classic", "bot-history-clock");
    snapshot.clocks = snapshot.clocks.map((clock) => (clock.color === "white" ? { ...clock, remainingMs: 10_000 } : clock));

    const historySnapshot = settleBotThinkingSnapshot(snapshot, 1_400);

    expect(historySnapshot.clocks.find((clock) => clock.color === "white")?.remainingMs).toBe(8_600);
    expect(snapshot.clocks.find((clock) => clock.color === "white")?.remainingMs).toBe(10_000);
  });

  test("does not apply a bot move if thinking time already caused timeout", () => {
    const snapshot = createInitialState("classic", "bot-timeout-before-move");
    snapshot.clocks = snapshot.clocks.map((clock) => (clock.color === "white" ? { ...clock, remainingMs: 700 } : clock));
    const move = { from: { row: 6, col: 4 }, to: { row: 5, col: 4 } };

    const next = applyBotMoveAfterThinking(snapshot, snapshot, move, 900);

    expect(next.status).toBe("completed");
    expect(next.outcomeReason).toBe("timeout");
    expect(next.ply).toBe(0);
  });

  test("formats chess clocks compactly", () => {
    expect(formatClock(65_000)).toBe("1:05");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(0, { untimed: true })).toBe("∞");
  });
});

describe("local game history", () => {
  test("supports undo, redo, and clearing redo after a new branch", () => {
    const start = createInitialState("classic", "timeline-start");
    const afterFirst = { ...start, id: "timeline-after-first", ply: 1 };
    const afterSecond = { ...start, id: "timeline-after-second", ply: 2 };
    const branch = { ...start, id: "timeline-branch", ply: 2 };

    const first = pushTimeline([], start, afterFirst);
    const second = pushTimeline(first.past, first.present, afterSecond);
    const undone = undoTimeline(second.past, second.present, second.future);
    expect(undone?.present.id).toBe("timeline-after-first");
    expect(undone?.future[0]?.id).toBe("timeline-after-second");

    const redone = redoTimeline(undone?.past ?? [], undone?.present ?? start, undone?.future ?? []);
    expect(redone?.present.id).toBe("timeline-after-second");

    const branched = pushTimeline(undone?.past ?? [], undone?.present ?? start, branch);
    expect(branched.present.id).toBe("timeline-branch");
    expect(branched.future).toEqual([]);
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

describe("theme shell", () => {
  test("does not render script tags from React components", () => {
    const markup = renderToStaticMarkup(
      createElement(ThemeProvider, null, createElement("main", null, "AllChess"))
    );

    expect(markup).not.toContain("<script");
  });
});
