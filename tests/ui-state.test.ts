import { describe, expect, test } from "vitest";

import { createDefaultStats } from "@/lib/stats";
import { timeControls } from "@/lib/time-controls";
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
});

describe("site statistics", () => {
  test("uses honest live-data placeholders instead of fake player counts", () => {
    const stats = createDefaultStats();

    expect(stats.playersOnline.value).toBe("Live soon");
    expect(stats.playersOnline.isEstimated).toBe(false);
  });
});
