import { BookOpen } from "lucide-react";

import { PieceIcon } from "@/components/board/piece-icon";
import { getVariant, variantCatalog } from "@/lib/variants/catalog";
import { getGamePresentation } from "@/lib/variants/presentation";
import { jungleTerrain } from "@/lib/variants/jungle-profile";

/** Decorative previews reuse the actual game's pieces, without implying guide-only games are playable. */
export function GameArtwork({ variantKey, locale = "en" }: { variantKey?: string | null; locale?: string }) {
  if (!variantKey || !variantCatalog.some((variant) => variant.key === variantKey)) {
    return <div className="game-artwork game-artwork-guide" aria-hidden="true"><BookOpen size={48} strokeWidth={1} /></div>;
  }
  const variant = getVariant(variantKey);
  const presentation = getGamePresentation(variantKey);
  const intersections = variantKey === "xiangqi" || variantKey === "janggi";
  const plain = ["ouk-chaktrang", "makruk", "shogi", "mini-shogi", "chaturanga", "shatranj", "turkish-draughts"].includes(variantKey);
  const { rows, cols } = variant.board;
  return (
    <div className="game-artwork library-art" data-tone={presentation.tone} data-game={variantKey} aria-hidden="true">
      <svg className="game-artwork-board" viewBox={`0 0 ${cols * 10} ${rows * 10}`}>
        <rect width={cols * 10} height={rows * 10} fill="var(--art-light)" />
        {intersections ? <g fill="none" stroke="var(--art-dark)" strokeWidth=".45">
          {Array.from({ length: rows }, (_, row) => <path key={`r${row}`} d={`M5 ${row * 10 + 5}H${cols * 10 - 5}`} />)}
          {Array.from({ length: cols }, (_, col) => <path key={`c${col}`} d={variantKey === "xiangqi" && col > 0 && col < cols - 1 ? `M${col * 10 + 5} 5V45M${col * 10 + 5} 55V${rows * 10 - 5}` : `M${col * 10 + 5} 5V${rows * 10 - 5}`} />)}
          <path d={`M35 5L55 25M55 5L35 25M35 ${rows * 10 - 25}L55 ${rows * 10 - 5}M55 ${rows * 10 - 25}L35 ${rows * 10 - 5}`} />
        </g> : Array.from({ length: rows * cols }, (_, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          if (variantKey === "konane") return <circle key={i} cx={col * 10 + 5} cy={row * 10 + 5} r="2.8" fill="var(--art-dark)" />;
          if (variantKey === "jungle") {
            const terrain = jungleTerrain({ row, col });
            const fill = terrain === "river" ? "#6e9fa5" : terrain === "den" ? "#657358" : terrain === "trap" ? "#bc9762" : "none";
            return <rect key={i} x={col * 10} y={row * 10} width="10" height="10" fill={fill} stroke="var(--art-dark)" strokeWidth=".35" />;
          }
          return <rect key={i} x={col * 10} y={row * 10} width="10" height="10" fill={plain ? "none" : (row + col) % 2 ? "var(--art-dark)" : "none"} stroke={plain ? "var(--art-dark)" : "none"} strokeWidth=".35" />;
        })}
      </svg>
      <div className="library-piece-group">{presentation.pieces.map((code, index) => <span key={index}><PieceIcon code={code} owner={variant.players[index === 2 ? 1 : 0]} variantKey={variantKey} locale={locale} /></span>)}</div>
    </div>
  );
}
