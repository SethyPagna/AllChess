import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { boardThemeOptions, getAppearancePresetOptions } from "@/components/board/appearance";
import { PlayControlCard } from "@/components/board/play-control-card";

describe("PlayControlCard", () => {
  test("renders board and piece appearance as unified matched sets", () => {
    const noop = vi.fn();
    const appearanceOptions = getAppearancePresetOptions("mini-shogi");
    const markup = renderToStaticMarkup(
      <PlayControlCard
        appearanceOptions={appearanceOptions}
        appearancePreset="tablet"
        botLevelLabel="Normal"
        botMode="human"
        boardTheme="jade"
        boardThemeOptions={boardThemeOptions}
        canEndGame={false}
        canRedo={false}
        canUndo={false}
        canUseAssist={false}
        canUseBots={false}
        gameStarted={false}
        isThinking={false}
        onApplySuggestion={noop}
        onCancelThinking={noop}
        onFlipBoard={noop}
        onMoveForCurrentSide={noop}
        onOfferDraw={noop}
        onAppearancePresetChange={noop}
        onRedo={noop}
        onResign={noop}
        onReset={noop}
        onSuggest={noop}
        onToggleAuto={noop}
        onToggleBot={noop}
        onUndo={noop}
        pieceSkin="tile"
        suggestedMoveReady={false}
        variantKey="mini-shogi"
      />
    );

    expect(markup).toContain("Look");
    expect(markup).toContain("Appearance set");
    expect(markup).toContain("<select");
    expect(markup).toContain('value="tablet"');
    expect(markup).toContain('data-appearance-option="tablet"');
    expect(markup).toContain('data-board-theme-option="jade"');
    expect(markup).toContain('data-piece-skin-option="tile"');
    expect(markup).toContain('aria-label="Appearance set options"');
    expect(markup).toContain('aria-label="Use Tablets appearance set"');
    expect(markup).toContain('class="play-look-piece-sample"');
    expect(markup).toContain('data-code="p"');
    expect(markup).toContain('data-variant="mini-shogi"');
    expect(markup).toContain('data-selected="true"');
    expect(markup).toContain("Selected appearance: Tablets, Jade clear board, tile pieces");
  });
});
