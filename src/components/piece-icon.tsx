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

export function PieceIcon({ code, owner, variantKey, promoted = false }: PieceIconProps) {
  const normalized = code.toLowerCase();
  if (variantKey === "classic" || variantKey === "chess960" || ["k", "q", "r", "b", "n", "p"].includes(normalized)) {
    return <WesternPieceIcon code={normalized} owner={owner} promoted={promoted} />;
  }

  return (
    <span className="piece-symbol piece-icon native-piece-symbol" data-owner={owner} data-piece="native" data-code={normalized} data-variant={variantKey}>
      {nativeGlyphs[normalized] ?? normalized.toUpperCase()}
    </span>
  );
}

function WesternPieceIcon({ code, owner, promoted }: { code: string; owner: PlayerColor; promoted: boolean }) {
  const piece = westernPieceName(code);
  return (
    <svg className="piece-symbol piece-icon piece-svg" data-owner={owner} data-piece={piece} data-promoted={promoted || undefined} viewBox="0 0 100 100" aria-hidden="true">
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
      <path d="M46.5 8h7v12.5H66v7H53.5v12.2h-7V27.5H34v-7h12.5z" />
      <path d="M34 80h32l-3.6-13.5H37.6z" />
      <path d="M25 65.8h50L66.5 38H33.5z" />
      <path d="M38 39c2.8-8.5 21.2-8.5 24 0l-4.4 18.5H42.4z" />
      <path d="M22 91h56v-10.5H22z" />
    </>
  );
}

function QueenPaths() {
  return (
    <>
      <circle cx="17" cy="27" r="6.5" />
      <circle cx="34" cy="16.5" r="6.2" />
      <circle cx="50" cy="12.5" r="7" />
      <circle cx="66" cy="16.5" r="6.2" />
      <circle cx="83" cy="27" r="6.5" />
      <path d="M22 37l12.5 30h31L78 37 58.5 53.5 50 25.5 41.5 53.5z" />
      <path d="M31 81h38l-4-14H35z" />
      <path d="M22 91h56V81H22z" />
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
      <circle cx="50" cy="28" r="13.5" />
      <path d="M39 48.5h22l5 12.5H34z" />
      <path d="M32 78.5h36l-6-18H38z" />
      <path d="M22 91h56V78.5H22z" />
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
