import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { DropSelectionHint } from "@/components/board/game-board";

describe("DropSelectionHint", () => {
  test("summarizes selected hand drops with a legal-square count", () => {
    const markup = renderToStaticMarkup(<DropSelectionHint legalTargetCount={7} locale="en" onCancel={() => undefined} pieceCode="g" pieceLabel="Gold" pieceOwner="sente" pieceSkin="default" variantKey="mini-shogi" />);

    expect(markup).toContain('aria-label="Dropping Gold"');
    expect(markup).toContain("drop-piece-preview");
    expect(markup).toContain('data-code="g"');
    expect(markup).toContain('data-skin="mini-wedge"');
    expect(markup).toContain("Drop Gold");
    expect(markup).toContain("7 legal squares");
    expect(markup).toContain("Drops must land on empty squares without leaving check.");
    expect(markup).toContain('aria-label="Cancel Gold drop"');
  });

  test("handles blocked hand drops without hiding the cancel action", () => {
    const markup = renderToStaticMarkup(<DropSelectionHint legalTargetCount={0} locale="en" onCancel={() => undefined} pieceCode="p" pieceLabel="Pawn" pieceOwner="sente" pieceSkin="default" variantKey="mini-shogi" />);

    expect(markup).toContain("No legal squares");
    expect(markup).toContain("Nifu, dead-rank, check, and pawn-drop mate rules are checked.");
    expect(markup).toContain("Cancel");
  });

  test("explains Crazyhouse pawn drop rank limits", () => {
    const markup = renderToStaticMarkup(<DropSelectionHint legalTargetCount={12} locale="en" onCancel={() => undefined} pieceCode="p" pieceLabel="Pawn" pieceOwner="white" pieceSkin="default" variantKey="crazyhouse" />);

    expect(markup).toContain("Pawns cannot drop on the first or last rank.");
  });
});
