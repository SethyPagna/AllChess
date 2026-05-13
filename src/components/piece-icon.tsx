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
      <path d="M46.7 7.5h6.6v11.2h11.2v6.6H53.3v9.8h-6.6v-9.8H35.5v-6.6h11.2z" data-detail="king-cross" />
      <path d="M34.6 40.2c3.3-8.8 27.5-8.8 30.8 0l-5.1 22.9H39.7z" />
      <path d="M25.3 64.1h49.4l-7.1-25.8-10 16.1L50 35.5l-7.6 18.9-10-16.1z" />
      <path d="M33 78.3h34l-4.2-14.2H37.2z" />
      <path d="M21.5 91.5h57v-11.8h-57z" data-detail="king-base" />
    </>
  );
}

function QueenPaths() {
  return (
    <>
      <circle cx="17.5" cy="29.5" r="6.1" data-detail="queen-jewel" />
      <circle cx="34" cy="18.7" r="5.8" data-detail="queen-jewel" />
      <circle cx="50" cy="14.2" r="6.5" data-detail="queen-jewel" />
      <circle cx="66" cy="18.7" r="5.8" data-detail="queen-jewel" />
      <circle cx="82.5" cy="29.5" r="6.1" data-detail="queen-jewel" />
      <path d="M20.8 39.1 34 67.4h32l13.2-28.3-19.5 14.6L50 26.7l-9.7 27z" />
      <path d="M35.5 66.1h29l4.2 13.8H31.3z" />
      <path d="M22.1 91.5h55.8V80.1H22.1z" data-detail="queen-base" />
    </>
  );
}

function RookPaths() {
  return (
    <>
      <path d="M22.5 18h13.2v10.2h8.7V18h11.2v10.2h8.7V18h13.2v25.2h-55z" data-detail="rook-turrets" />
      <path d="M30.7 42.8h38.6v35H30.7z" />
      <path d="M24 91.5h52V77.7H24z" data-detail="rook-base" />
    </>
  );
}

function BishopPaths() {
  return (
    <>
      <path d="M50 10.5c12.9 9.8 21.2 21.6 21.2 35.4 0 12.7-8.4 22.1-21.2 22.1s-21.2-9.4-21.2-22.1c0-13.8 8.3-25.6 21.2-35.4z" />
      <path d="M45.3 25.5h9.4v29h-9.4z" fill="var(--piece-cutout)" stroke="var(--piece-cutout)" data-detail="bishop-mitre-slit" />
      <path d="M37 80.3h26l-3.8-13.7H40.8z" />
      <path d="M24.5 91.5h51v-11.2h-51z" data-detail="bishop-base" />
    </>
  );
}

function KnightPaths() {
  return (
    <>
      <path d="M27 86.5h46.5c-4.5-11.6-8.4-23.8-8.4-38.4 0-16-12.7-27.6-31.5-31.8L27 28.7l9.7 5.4-13 10.7c-5.5 5.1-7.1 12.6-4.4 19.2l12.3-6.1c2.8 8.7 1.7 17.5-4.6 28.6z" />
      <path d="M43.3 29.2c2.4 0 4.2 1.8 4.2 4s-1.8 4-4.2 4-4.2-1.8-4.2-4 1.8-4 4.2-4z" fill="var(--piece-cutout)" stroke="var(--piece-cutout)" data-detail="knight-eye" />
      <path d="M49.4 43.2c-4.5 3.6-8.8 5.2-13.1 4.8" fill="none" />
      <path d="M23.5 94h55v-8.6h-55z" data-detail="knight-base" />
    </>
  );
}

function PawnPaths() {
  return (
    <>
      <circle cx="50" cy="27.2" r="13.2" data-detail="pawn-head" />
      <path d="M38.5 48h23l5.3 13H33.2z" />
      <path d="M31.7 78.5h36.6l-6.4-17.7H38.1z" />
      <path d="M21.8 91.5h56.4v-13H21.8z" data-detail="pawn-base" />
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
