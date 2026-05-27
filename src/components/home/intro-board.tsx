import { PieceIcon } from "@/components/board/piece-icon";
import type { PlayerColor } from "@/lib/variants";

const introPieces: Record<number, { code: string; owner: PlayerColor }> = {
  0: { code: "r", owner: "black" },
  1: { code: "n", owner: "black" },
  2: { code: "b", owner: "black" },
  3: { code: "q", owner: "black" },
  4: { code: "k", owner: "black" },
  5: { code: "b", owner: "black" },
  6: { code: "n", owner: "black" },
  7: { code: "r", owner: "black" },
  8: { code: "p", owner: "black" },
  9: { code: "p", owner: "black" },
  10: { code: "p", owner: "black" },
  11: { code: "p", owner: "black" },
  12: { code: "p", owner: "black" },
  13: { code: "p", owner: "black" },
  14: { code: "p", owner: "black" },
  15: { code: "p", owner: "black" },
  48: { code: "p", owner: "white" },
  49: { code: "p", owner: "white" },
  50: { code: "p", owner: "white" },
  51: { code: "p", owner: "white" },
  52: { code: "p", owner: "white" },
  53: { code: "p", owner: "white" },
  54: { code: "p", owner: "white" },
  55: { code: "p", owner: "white" },
  56: { code: "r", owner: "white" },
  57: { code: "n", owner: "white" },
  58: { code: "b", owner: "white" },
  59: { code: "q", owner: "white" },
  60: { code: "k", owner: "white" },
  61: { code: "b", owner: "white" },
  62: { code: "n", owner: "white" },
  63: { code: "r", owner: "white" }
};

const BOARD_SQUARE_COUNT = 64;
const BOARD_FILE_COUNT = 8;

export function IntroBoard() {
  return (
    <div className="intro-board-orbit" aria-label="Classic chess board preview" role="img">
      <div className="intro-board">
        {Array.from({ length: BOARD_SQUARE_COUNT }, (_, index) => {
          const piece = introPieces[index];
          const row = Math.floor(index / BOARD_FILE_COUNT);
          const col = index % BOARD_FILE_COUNT;
          const isLight = (row + col) % 2 === 0;

          return (
            <span key={index} className={isLight ? "is-light" : "is-dark"}>
              {piece ? <PieceIcon code={piece.code} owner={piece.owner} variantKey="classic" /> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
