import type { PlayerColor } from "@/lib/variants";

type PieceIconProps = {
  code: string;
  owner: PlayerColor;
  variantKey: string;
  promoted?: boolean;
};

const nativeGlyphs: Record<string, string> = {
  g: "\u738b",
  a: "\u58eb",
  e: "\u8c61",
  h: "\u99ac",
  c: "\u70ae",
  s: "\u9280",
  l: "\u9999",
  d: "\u72ac",
  w: "\u72fc",
  t: "\u864e"
};

export function PieceIcon({ code, variantKey, promoted = false }: PieceIconProps) {
  const normalized = code.toLowerCase();
  if (variantKey === "classic" || variantKey === "chess960" || ["k", "q", "r", "b", "n", "p"].includes(normalized)) {
    return <WesternPieceIcon code={normalized} promoted={promoted} />;
  }

  return (
    <span className="piece-icon native-piece-symbol" data-piece="native" data-code={normalized}>
      {nativeGlyphs[normalized] ?? normalized.toUpperCase()}
    </span>
  );
}

function WesternPieceIcon({ code, promoted }: { code: string; promoted: boolean }) {
  const piece = westernPieceName(code);
  return (
    <svg className="piece-icon piece-svg" data-piece={piece} data-promoted={promoted || undefined} viewBox="0 0 100 100" aria-hidden="true">
      {piece === "king" ? <KingPaths /> : null}
      {piece === "queen" ? <QueenPaths /> : null}
      {piece === "rook" ? <RookPaths /> : null}
      {piece === "bishop" ? <BishopPaths /> : null}
      {piece === "knight" ? <KnightPaths /> : null}
      {piece === "pawn" ? <PawnPaths /> : null}
    </svg>
  );
}

function KingPaths() {
  return (
    <>
      <path d="M47 10h6v13h13v6H53v13h-6V29H34v-6h13z" />
      <path d="M31 82h38l-4-15H35z" />
      <path d="M28 65h44l-7-26H35z" />
      <path d="M38 40c2-9 22-9 24 0l-4 18H42z" />
      <path d="M25 90h50v-8H25z" />
    </>
  );
}

function QueenPaths() {
  return (
    <>
      <circle cx="20" cy="25" r="6" />
      <circle cx="38" cy="16" r="6" />
      <circle cx="50" cy="13" r="7" />
      <circle cx="62" cy="16" r="6" />
      <circle cx="80" cy="25" r="6" />
      <path d="M25 34l10 31h30l10-31-18 17-7-25-7 25z" />
      <path d="M32 82h36l-3-17H35z" />
      <path d="M25 90h50v-8H25z" />
    </>
  );
}

function RookPaths() {
  return (
    <>
      <path d="M25 18h12v10h10V18h12v10h10V18h8v25H23V18z" />
      <path d="M31 43h38v34H31z" />
      <path d="M24 90h52V77H24z" />
    </>
  );
}

function BishopPaths() {
  return (
    <>
      <path d="M50 11c12 10 20 20 20 34 0 13-9 23-20 23S30 58 30 45c0-14 8-24 20-34z" />
      <path d="M45 27h10v26H45z" fill="var(--board-light)" />
      <path d="M37 81h26l-3-14H40z" />
      <path d="M25 90h50v-9H25z" />
    </>
  );
}

function KnightPaths() {
  return (
    <>
      <path d="M29 86h44c-4-12-8-24-8-38 0-15-12-27-28-31l-7 12 9 5-12 10c-5 5-7 12-4 19l10-6c3 8 2 18-4 29z" />
      <circle cx="43" cy="32" r="3" fill="var(--board-light)" />
      <path d="M24 94h54v-8H24z" />
    </>
  );
}

function PawnPaths() {
  return (
    <>
      <circle cx="50" cy="30" r="14" />
      <path d="M38 52h24l7 27H31z" />
      <path d="M25 90h50V79H25z" />
    </>
  );
}

function westernPieceName(code: string) {
  const names: Record<string, string> = {
    k: "king",
    q: "queen",
    r: "rook",
    b: "bishop",
    n: "knight",
    p: "pawn"
  };
  return names[code] ?? "pawn";
}
