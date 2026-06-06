import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { BoardGrid } from "@/components/board/board-grid";
import type { BoardCell } from "@/lib/variants";

function renderGrid(orientedRows: BoardCell[][], variantKey = "classic", locale = "en") {
  return renderToStaticMarkup(
    <BoardGrid
      cols={orientedRows[0]?.length ?? 0}
      files={["a", "b"]}
      legalTargets={new Set()}
      locale={locale}
      onChoose={() => undefined}
      orientedRows={orientedRows}
      rows={orientedRows.length}
      selected={null}
      suggestedMove={null}
      variantKey={variantKey}
    />
  );
}

describe("BoardGrid", () => {
  test("labels square buttons with coordinates and piece names", () => {
    const markup = renderGrid([
      [
        { square: { row: 0, col: 0 }, piece: null },
        { square: { row: 0, col: 1 }, piece: null }
      ],
      [
        { square: { row: 1, col: 0 }, piece: { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" } },
        { square: { row: 1, col: 1 }, piece: null }
      ]
    ]);

    expect(markup).toContain('aria-label="a1 white King"');
    expect(markup).toContain('title="a1 white King"');
    expect(markup).toContain('data-coordinate="a1"');
    expect(markup).toContain('data-piece-label="King"');
    expect(markup).toContain('aria-label="b1"');
    expect(markup).not.toContain('data-piece-label=""');
  });

  test("keeps localized variant piece names on square metadata", () => {
    const pawnName = "\u6b69";
    const markup = renderGrid(
      [
        [
          { square: { row: 0, col: 0 }, piece: null },
          { square: { row: 0, col: 1 }, piece: null }
        ],
        [
          { square: { row: 1, col: 0 }, piece: { id: "sente-pawn", code: "p", owner: "sente", labelKey: "chess.pawn" } },
          { square: { row: 1, col: 1 }, piece: null }
        ]
      ],
      "shogi",
      "ja"
    );

    expect(markup).toContain(`aria-label="a1 sente ${pawnName}"`);
    expect(markup).toContain(`title="a1 sente ${pawnName}"`);
    expect(markup).toContain(`data-piece-label="${pawnName}"`);
  });
});
