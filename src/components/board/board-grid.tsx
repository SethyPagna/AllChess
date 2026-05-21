import { PieceIcon } from "@/components/board/piece-icon";
import { pieceName, squareName } from "@/components/board/game-board-utils";
import { sameSquare, serializeSquare, type BoardCell, type Square } from "@/lib/variants";

type SuggestedBoardMove = {
  from: Square;
  to: Square;
};

type BoardGridProps = {
  cols: number;
  files: string[];
  legalTargets: ReadonlySet<string>;
  onChoose: (square: Square) => void;
  orientedRows: BoardCell[][];
  rows: number;
  selected: Square | null;
  suggestedMove: SuggestedBoardMove | null;
  variantKey: string;
};

export function BoardGrid({ cols, files, legalTargets, onChoose, orientedRows, rows, selected, suggestedMove, variantKey }: BoardGridProps) {
  return (
    <div className="board-grid overflow-hidden rounded-lg border border-[var(--border)] shadow-2xl" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} aria-label="Game board">
      {orientedRows.flatMap((row, visualRow) =>
        row.map((cell, visualCol) => {
          const isSelected = selected && sameSquare(selected, cell.square);
          const isLegal = legalTargets.has(serializeSquare(cell.square));
          const isSuggestedFrom = suggestedMove && sameSquare(suggestedMove.from, cell.square);
          const isSuggestedTo = suggestedMove && sameSquare(suggestedMove.to, cell.square);
          const dark = (cell.square.row + cell.square.col) % 2 === 1;
          const isDarkPiece = cell.piece?.owner === "black" || cell.piece?.owner === "blue" || cell.piece?.owner === "gote";
          const name = squareName(cell.square, files, rows);

          return (
            <button
              type="button"
              key={serializeSquare(cell.square)}
              onClick={() => onChoose(cell.square)}
              className="board-square focus-ring relative grid place-items-center overflow-hidden font-black"
              aria-label={cell.piece ? `${name} ${cell.piece.owner} ${pieceName(cell.piece.code)}` : name}
              data-square={name}
              data-tone={dark ? "dark" : "light"}
              data-suggested={isSuggestedFrom ? "from" : isSuggestedTo ? "to" : undefined}
              style={{
                background: isSelected
                  ? "var(--accent)"
                  : isSuggestedFrom || isSuggestedTo
                    ? "color-mix(in srgb, var(--info) 46%, var(--board-light))"
                    : isLegal
                      ? "color-mix(in srgb, var(--accent) 34%, var(--board-light))"
                      : dark
                        ? "var(--board-dark)"
                        : "var(--board-light)",
                color: isDarkPiece ? "var(--piece-dark)" : "var(--piece-light)"
              }}
            >
              {visualCol === 0 ? <span className="board-coordinate board-rank">{rows - cell.square.row}</span> : null}
              {visualRow === rows - 1 ? <span className="board-coordinate board-file">{files[cell.square.col]}</span> : null}
              {cell.piece ? <PieceIcon code={cell.piece.code} owner={cell.piece.owner} variantKey={variantKey} promoted={cell.piece.promoted} /> : null}
            </button>
          );
        })
      )}
    </div>
  );
}
