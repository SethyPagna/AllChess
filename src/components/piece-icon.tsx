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
  if (usesWesternPresentation(variantKey)) {
    return <WesternPieceIcon code={normalized} owner={owner} variantKey={variantKey} promoted={promoted} />;
  }

  const glyph = getNativeGlyph({ code: normalized, owner, variantKey, promoted });
  const pieceName = getNativePieceName({ code: normalized, variantKey, promoted });

  return (
    <span
      aria-label={pieceName}
      className="piece-symbol piece-icon native-piece-symbol"
      data-owner={owner}
      data-piece="native"
      data-code={normalized}
      data-variant={variantKey}
      data-promoted={promoted || undefined}
      role="img"
    >
      {glyph}
    </span>
  );
}

function usesWesternPresentation(variantKey: string) {
  return ["classic", "chess960", "antichess", "horde", "king-of-the-hill", "three-check", "makruk"].includes(variantKey);
}

function WesternPieceIcon({ code, owner, variantKey, promoted }: { code: string; owner: PlayerColor; variantKey: string; promoted: boolean }) {
  const piece = westernPieceName(code, variantKey);
  return (
    <svg
      aria-label={piece}
      className="piece-symbol piece-icon piece-svg"
      data-owner={owner}
      data-piece={piece}
      data-promoted={promoted || undefined}
      data-variant={variantKey}
      role="img"
      viewBox="0 0 100 100"
    >
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

function getNativeGlyph({ code, owner, variantKey, promoted }: { code: string; owner: PlayerColor; variantKey: string; promoted: boolean }) {
  if (variantKey === "xiangqi") {
    const red: Record<string, string> = { g: "\u5e25", a: "\u4ed5", e: "\u76f8", h: "\u509c", r: "\u4fe5", c: "\u70ae", p: "\u5175" };
    const black: Record<string, string> = { g: "\u5c07", a: "\u58eb", e: "\u8c61", h: "\u99ac", r: "\u8eca", c: "\u7832", p: "\u5352" };
    return (owner === "red" ? red : black)[code] ?? nativeGlyphs[code] ?? code.toUpperCase();
  }
  if (variantKey === "janggi") {
    const red: Record<string, string> = { g: "\u695a", a: "\u58eb", e: "\u8c61", h: "\u99ac", r: "\u8eca", c: "\u5305", p: "\u5352" };
    const blue: Record<string, string> = { g: "\u6f22", a: "\u58eb", e: "\u8c61", h: "\u99ac", r: "\u8eca", c: "\u5305", p: "\u5175" };
    return (owner === "blue" ? blue : red)[code] ?? nativeGlyphs[code] ?? code.toUpperCase();
  }
  if (variantKey === "shogi") {
    const base: Record<string, string> = { k: "\u738b", r: "\u98db", b: "\u89d2", g: "\u91d1", s: "\u9280", n: "\u6842", l: "\u9999", p: "\u6b69" };
    const promotedMap: Record<string, string> = { r: "\u9f8d", b: "\u99ac", s: "\u5168", n: "\u572d", l: "\u674f", p: "\u3068" };
    return promoted ? promotedMap[code] ?? base[code] ?? code.toUpperCase() : base[code] ?? code.toUpperCase();
  }
  if (variantKey === "jungle") {
    const animals: Record<string, string> = { e: "\u8c61", l: "\u7345", t: "\u864e", p: "\u8c79", w: "\u72fc", d: "\u72ac", c: "\u8c93", r: "\u9f20" };
    return animals[code] ?? code.toUpperCase();
  }
  return nativeGlyphs[code] ?? code.toUpperCase();
}

function getNativePieceName({ code, variantKey, promoted }: { code: string; variantKey: string; promoted: boolean }) {
  const prefix = promoted ? "Promoted " : "";
  const names: Record<string, Record<string, string>> = {
    xiangqi: { g: "General", a: "Advisor", e: "Elephant", h: "Horse", r: "Chariot", c: "Cannon", p: "Soldier" },
    janggi: { g: "General", a: "Guard", e: "Elephant", h: "Horse", r: "Chariot", c: "Cannon", p: "Soldier" },
    shogi: { k: "King", r: "Rook", b: "Bishop", g: "Gold General", s: "Silver General", n: "Knight", l: "Lance", p: "Pawn" },
    jungle: { e: "Elephant", l: "Lion", t: "Tiger", p: "Leopard", w: "Wolf", d: "Dog", c: "Cat", r: "Rat" }
  };
  return `${prefix}${names[variantKey]?.[code] ?? "Piece"}`;
}

function westernPieceName(code: string, variantKey: string) {
  if (variantKey === "makruk") {
    const makrukNames: Record<string, string> = {
      k: "king",
      s: "bishop",
      n: "knight",
      r: "rook",
      p: "pawn"
    };
    return makrukNames[code] ?? "queen";
  }
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
