import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { PlayControlCard } from "@/components/board/play-control-card";
import { getPieceSkinOptions } from "@/components/board/piece-icon";

describe("PlayControlCard", () => {
  test("renders piece skins as compact swatch radio buttons", () => {
    const noop = vi.fn();
    const markup = renderToStaticMarkup(
      <PlayControlCard
        botLevelLabel="Normal"
        botMode="human"
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
        onPieceSkinChange={noop}
        onRedo={noop}
        onResign={noop}
        onReset={noop}
        onSuggest={noop}
        onToggleAuto={noop}
        onToggleBot={noop}
        onUndo={noop}
        pieceSkin="tile"
        pieceSkinOptions={getPieceSkinOptions("mini-shogi")}
        suggestedMoveReady={false}
      />
    );

    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain('aria-label="Piece skin"');
    expect(markup).toContain('data-skin-option="mini-wedge"');
    expect(markup).toContain('data-skin-option="tile"');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain("Selected piece skin: Tile");
    expect(markup).not.toContain("<select");
  });
});
