import type { PlayerColor } from "@/lib/variants";
import { shogiPromotedCodes } from "./board-3d-config";

const names: Record<string, string> = {
  k: "king", q: "queen", m: "queen", b: "bishop", s: "bishop", n: "knight", r: "rook", p: "pawn"
};
const shogiNames: Record<string, string> = { k: "king", r: "rook", b: "bishop", g: "gold", s: "silver", n: "knight", l: "lance", p: "pawn" };
// Masters have the same framing; retain the real 34–39 mm tile hierarchy.
const shogiLengths: Record<string, number> = { k: 39, r: 38, b: 38, g: 36.5, s: 36.5, n: 35.5, l: 35, p: 34 };

type Props = {
  code: string; owner: PlayerColor; label: string; variantKey: string; promoted?: boolean; khmerSet?: "atelier" | "courtyard"; draughtsSet?: "rosette" | "club"; shogiSet?: "hori";
};

/** Alpha assets keep real surface detail while the SVG supplies scalable layout and semantics. */
export function PhotographicPiece({ code, owner, label, variantKey, promoted = false, khmerSet, draughtsSet, shogiSet }: Props) {
  const name = draughtsSet ? code === "x" || promoted ? "king" : "man" : khmerSet && code === "n" ? "horse" : names[code] ?? "pawn";
  const side = owner === "black" || owner === "blue" || owner === "gote" ? "dark" : "light";
  const shogiName = code === "k" && owner === "sente" ? "king-jewel" : `${promoted && shogiPromotedCodes.has(code) ? "promoted-" : ""}${shogiNames[code] ?? "pawn"}`;
  const href = shogiSet ? `/assets/shogi/${shogiSet}/${shogiName}.webp` : draughtsSet ? `/assets/draughts/${draughtsSet}/${side}-${name}.webp` : khmerSet ? `/assets/khmer/${khmerSet}/${side}-${name}.webp` : `/assets/classic/marble/${side}_${name}.png`;
  const imageSize = shogiSet ? 100 * (shogiLengths[code] ?? 39) / 39 : 100;
  const imageInset = (100 - imageSize) / 2;
  return <svg viewBox="0 0 100 100" role="img" aria-label={label} className="piece-symbol piece-icon piece-svg photographic-piece"
    data-owner={owner} data-skin={shogiSet ?? draughtsSet ?? khmerSet ?? "marble"} data-piece={shogiSet ? shogiName : khmerSet ? "khmer" : name} data-piece-label={label}
    data-code={code} data-variant={variantKey} data-promoted={promoted || undefined}>
    <title>{label}</title><image href={href} x={imageInset} y={imageInset} width={imageSize} height={imageSize} />
    {promoted && !draughtsSet && !shogiSet ? <circle cx="80" cy="78" r="5" fill="#d9b45c" stroke="#352611" strokeWidth="1.5"/> : null}
  </svg>;
}
