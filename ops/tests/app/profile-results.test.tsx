import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfileResults } from "@/components/profile/profile-results";
import { outcomeReasonLabel } from "@/lib/game/outcome";
import type { RuntimeProfileHistory } from "@/lib/profile/runtime";

type Result = RuntimeProfileHistory["results"][number];

describe("profile results", () => {
  test("labels stored outcome reasons in sentence case", () => {
    expect(outcomeReasonLabel("royal-captured")).toBe("Royal capture");
    expect(outcomeReasonLabel("fifty-move")).toBe("Fifty-move rule");
    expect(outcomeReasonLabel("lost-all-pieces")).toBe("Lost all pieces");
    expect(outcomeReasonLabel("timeout")).toBe("Timeout");
    expect(outcomeReasonLabel("some-new-reason")).toBe("Some new reason");
    expect(outcomeReasonLabel("toString")).toBe("ToString");
  });

  test("rows read as plain text, not raw slugs, and keep one list head", () => {
    const markup = renderToStaticMarkup(
      <ProfileResults
        locale="en"
        history={{
          source: "d1",
          profileId: "kasparov",
          stats: [],
          results: [
            createResult({ id: "a", outcomeReason: "royal-captured", result: "win", ratingDelta: 8 }),
            createResult({ id: "b", outcomeReason: "fifty-move", result: "draw", ratingDelta: null }),
            createResult({ id: "c", outcomeReason: null, result: "loss", ratingDelta: -5 })
          ]
        }}
      />
    );

    expect(markup).toContain("Royal capture · ");
    expect(markup).toContain("Fifty-move rule · ");
    expect(markup).toContain("Recorded result · ");
    expect(markup).not.toContain("Royal-captured");
    expect(markup).not.toContain("Full history");
    expect(markup).toContain('class="profile-row focus-ring"');
    expect(markup).toContain(">+8<");
    expect(markup).toContain(">Unrated<");
  });

  test("guests get an icon avatar and named players get word initials", () => {
    const guest = renderToStaticMarkup(<ProfileHero displayName="Guest player" isGuest locale="en" settingsLabel="Settings" signInLabel="Sign in" />);
    expect(guest).toContain("lucide-user-round");
    expect(guest).not.toContain(">GU<");
    expect(guest).toContain("/en/login");

    const named = renderToStaticMarkup(<ProfileHero displayName="magnus_carlsen" isGuest={false} locale="en" settingsLabel="Settings" signInLabel={null} />);
    expect(named).toContain(">MC<");
    expect(named).not.toContain("/en/login");
    expect(renderToStaticMarkup(<ProfileHero displayName="hikaru" isGuest={false} locale="en" settingsLabel="Settings" signInLabel={null} />)).toContain(">H<");
  });
});

function createResult(overrides: Partial<Result>): Result {
  return {
    id: "result",
    gameId: "game-1",
    profileId: "kasparov",
    familyKey: "chess",
    variantKey: "classic",
    timeControlKey: "rapid",
    mode: "online",
    result: "win",
    outcomeReason: "checkmate",
    rated: true,
    ratingDelta: 0,
    movesPlayed: 30,
    durationMs: null,
    completedAt: "2026-09-03T12:00:00.000Z",
    createdAt: "2026-09-03T12:00:00.000Z",
    ...overrides
  };
}
