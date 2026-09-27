import type { PlayerColor } from "@/lib/variants";

const names: Record<string, string> = {
  k: "king", q: "queen", m: "queen", b: "bishop", s: "bishop", n: "knight", r: "rook", p: "pawn"
};

type Props = {
  code: string; owner: PlayerColor; label: string; variantKey: string; promoted?: boolean; khmerSet?: "atelier" | "courtyard"; draughtsSet?: "rosette" | "club";
};

/** Alpha assets keep real surface detail while the SVG supplies scalable layout and semantics. */
export function PhotographicPiece({ code, owner, label, variantKey, promoted = false, khmerSet, draughtsSet }: Props) {
  const name = draughtsSet ? code === "x" || promoted ? "king" : "man" : khmerSet && code === "n" ? "horse" : names[code] ?? "pawn";
  const side = owner === "black" || owner === "blue" || owner === "gote" ? "dark" : "light";
  const href = draughtsSet ? `/assets/draughts/${draughtsSet}/${side}-${name}.webp` : khmerSet ? `/assets/khmer/${khmerSet}/${side}-${name}.webp` : `/assets/classic/marble/${side}_${name}.png`;
  return <svg viewBox="0 0 100 100" role="img" aria-label={label} className="piece-symbol piece-icon piece-svg photographic-piece"
    data-owner={owner} data-skin={draughtsSet ?? khmerSet ?? "marble"} data-piece={khmerSet ? "khmer" : name} data-piece-label={label}
    data-code={code} data-variant={variantKey} data-promoted={promoted || undefined}>
    <title>{label}</title><image href={href} x="0" y="0" width="100" height="100" />
    {promoted && !draughtsSet ? <circle cx="80" cy="78" r="5" fill="#d9b45c" stroke="#352611" strokeWidth="1.5"/> : null}
  </svg>;
}
