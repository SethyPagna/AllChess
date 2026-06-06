import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { BoardGrid } from "@/components/board/board-grid";
import type { BoardCell, Square } from "@/lib/variants";

type RenderGridOptions = {
  legalTargetMode?: "move" | "drop";
  legalTargets?: ReadonlySet<string>;
  locale?: string;
  selected?: Square | null;
  suggestedMove?: { from: Square; to: Square } | null;
  variantKey?: string;
};

function renderGrid(orientedRows: BoardCell[][], options: RenderGridOptions = {}) {
  return renderToStaticMarkup(
    <BoardGrid
      cols={orientedRows[0]?.length ?? 0}
      files={["a", "b"]}
      legalTargets={options.legalTargets ?? new Set()}
      legalTargetMode={options.legalTargetMode}
      locale={options.locale ?? "en"}
      onChoose={() => undefined}
      orientedRows={orientedRows}
      rows={orientedRows.length}
      selected={options.selected ?? null}
      suggestedMove={options.suggestedMove ?? null}
      variantKey={options.variantKey ?? "classic"}
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
    expect(markup).toContain('class="board-coordinate board-rank"');
    expect(markup).toContain('class="board-coordinate board-file"');
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
      { locale: "ja", variantKey: "shogi" }
    );

    expect(markup).toContain(`aria-label="a1 sente ${pawnName}"`);
    expect(markup).toContain(`title="a1 sente ${pawnName}"`);
    expect(markup).toContain(`data-piece-label="${pawnName}"`);
  });

  test("describes legal, selected, and suggested target states", () => {
    const rows: BoardCell[][] = [
      [
        { square: { row: 0, col: 0 }, piece: null },
        { square: { row: 0, col: 1 }, piece: null }
      ],
      [
        { square: { row: 1, col: 0 }, piece: { id: "white-king", code: "k", owner: "white", labelKey: "chess.king" } },
        { square: { row: 1, col: 1 }, piece: null }
      ]
    ];

    const selectedMarkup = renderGrid(rows, { selected: { row: 1, col: 0 } });
    const legalMarkup = renderGrid(rows, { legalTargets: new Set(["0:1"]) });
    const suggestedMarkup = renderGrid(rows, {
      suggestedMove: {
        from: { row: 1, col: 0 },
        to: { row: 0, col: 1 }
      }
    });

    expect(selectedMarkup).toContain('aria-label="a1 white King - Selected square"');
    expect(selectedMarkup).toContain('data-square-state="selected"');
    expect(legalMarkup).toContain('aria-label="b2 - Legal move target"');
    expect(legalMarkup).toContain('data-legal-target="move"');
    expect(legalMarkup).toContain('data-square-state="legal-target"');
    expect(suggestedMarkup).toContain('aria-label="a1 white King - Suggested move starts here"');
    expect(suggestedMarkup).toContain('data-square-state="suggested-from"');
    expect(suggestedMarkup).toContain('aria-label="b2 - Suggested move target"');
    expect(suggestedMarkup).toContain('data-square-state="suggested-to"');
  });

  test("describes legal drop targets when a hand piece is selected", () => {
    const markup = renderGrid(
      [
        [
          { square: { row: 0, col: 0 }, piece: null },
          { square: { row: 0, col: 1 }, piece: null }
        ],
        [
          { square: { row: 1, col: 0 }, piece: null },
          { square: { row: 1, col: 1 }, piece: null }
        ]
      ],
      { legalTargetMode: "drop", legalTargets: new Set(["0:1"]) }
    );

    expect(markup).toContain('aria-label="b2 - Legal drop target"');
    expect(markup).toContain('title="b2 - Legal drop target"');
    expect(markup).toContain('data-legal-target="drop"');
    expect(markup).toContain('data-square-state="legal-drop-target"');
  });

  test("renders a planning layer for right-click arrows", () => {
    const markup = renderGrid([
      [
        { square: { row: 0, col: 0 }, piece: null },
        { square: { row: 0, col: 1 }, piece: null }
      ],
      [
        { square: { row: 1, col: 0 }, piece: null },
        { square: { row: 1, col: 1 }, piece: null }
      ]
    ]);

    expect(markup).toContain('class="board-planning-layer"');
    expect(markup).toContain('id="board-planning-arrow"');
  });
});
