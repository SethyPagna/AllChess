import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { PlayControlCard, type BoardThemeOption } from "@/components/board/play-control-card";
import { getPieceSkinOptions } from "@/components/board/piece-icon";

describe("PlayControlCard", () => {
  test("renders board and piece appearance as compact select controls", () => {
    const noop = vi.fn();
    const boardThemeOptions: BoardThemeOption[] = [
      { key: "classic", label: "Classic green" },
      { key: "wood", label: "Warm wood" }
    ];
    const markup = renderToStaticMarkup(
      <PlayControlCard
        botLevelLabel="Normal"
        botMode="human"
        boardTheme="wood"
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
        onBoardThemeChange={noop}
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

    expect(markup).toContain("Look");
    expect(markup).toContain("<select");
    expect(markup).toContain('value="wood"');
    expect(markup).toContain('value="tile"');
    expect(markup).toContain('data-board-theme-option="wood"');
    expect(markup).toContain('data-selected="true"');
    expect(markup).toContain("Selected appearance: Warm wood board, Tile pieces");
  });
});
