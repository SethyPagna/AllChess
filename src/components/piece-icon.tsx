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
      <title>{piece}</title>
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
      <path d="M46.4 7.8h7.2v11.4h11.4v7.2H53.6v10.3h-7.2V26.4H35v-7.2h11.4z" data-detail="king-cross" />
      <path d="M29.4 63.4c1.9-15.7 10.4-25.7 20.6-25.7s18.7 10 20.6 25.7z" />
      <path d="M35.8 76.7h28.4l3.6-13.3H32.2z" />
      <path d="M23.4 91.4h53.2V78.2H23.4z" data-detail="king-base" />
      <path d="M34.2 63.4c4.2 4.1 27.4 4.1 31.6 0" fill="none" data-detail="king-collar" />
    </>
  );
}

function QueenPaths() {
  return (
    <>
      <circle cx="18.4" cy="29.5" r="6" data-detail="queen-jewel" />
      <circle cx="34.2" cy="18.8" r="5.7" data-detail="queen-jewel" />
      <circle cx="50" cy="14.6" r="6.4" data-detail="queen-jewel" />
      <circle cx="65.8" cy="18.8" r="5.7" data-detail="queen-jewel" />
      <circle cx="81.6" cy="29.5" r="6" data-detail="queen-jewel" />
      <path d="M19.8 40.1 33 67.1h34l13.2-27-20.6 13.3L50 27.4l-9.6 26z" />
      <path d="M33.2 78.5h33.6l-3.2-11.4H36.4z" />
      <path d="M22.2 91.4h55.6V78.5H22.2z" data-detail="queen-base" />
      <path d="M35.8 67.1c4.8 3.1 23.6 3.1 28.4 0" fill="none" data-detail="queen-collar" />
    </>
  );
}

function RookPaths() {
  return (
    <>
      <path d="M21.4 17.3h14.1v10.4h8.9V17.3h11.2v10.4h8.9V17.3h14.1v25.3H21.4z" data-detail="rook-turrets" />
      <path d="M29.7 42.6h40.6v35.8H29.7z" />
      <path d="M22.8 91.4h54.4v-13H22.8z" data-detail="rook-base" />
      <path d="M31 53.3h38" fill="none" data-detail="rook-stone-course" />
    </>
  );
}

function BishopPaths() {
  return (
    <>
      <path d="M50 10.4c13.4 10.4 21.5 22.2 21.5 35.7 0 13-8.8 22.6-21.5 22.6s-21.5-9.6-21.5-22.6c0-13.5 8.1-25.3 21.5-35.7z" />
      <path d="M57.9 26.4 43.5 56.8" fill="none" stroke="var(--piece-cutout)" strokeWidth="7.2" data-detail="bishop-mitre-slit" />
      <path d="M37.1 79.2h25.8l-3.8-11.1H40.9z" />
      <path d="M24.2 91.4h51.6V79.2H24.2z" data-detail="bishop-base" />
      <path d="M38.6 68.1c5.5 3.4 17.3 3.4 22.8 0" fill="none" data-detail="bishop-collar" />
    </>
  );
}

function KnightPaths() {
  return (
    <>
      <path d="M25.8 86.4h48.4c-4.7-11.5-8.2-22.4-8.2-37 0-17.8-13.4-29.9-32.4-33.9L25.2 28l10.9 5.3-13.7 10.8c-5.9 5.4-7.4 13.1-4.7 19.9l13.2-6.4c2.7 9.2 1.2 18-5.1 28.8z" />
      <path d="M42.9 29.2c2.5 0 4.4 1.8 4.4 4.1s-1.9 4.1-4.4 4.1-4.4-1.8-4.4-4.1 1.9-4.1 4.4-4.1z" fill="var(--piece-cutout)" stroke="var(--piece-cutout)" data-detail="knight-eye" />
      <path d="M51.8 43.6c-5.8 4.7-11.3 6.3-16.9 5" fill="none" data-detail="knight-muzzle" />
      <path d="M23 94h54v-7.6H23z" data-detail="knight-base" />
    </>
  );
}

function PawnPaths() {
  return (
    <>
      <circle cx="50" cy="26.8" r="13.5" data-detail="pawn-head" />
      <path d="M38.7 48.2h22.6l5.9 13.4H32.8z" />
      <path d="M31.5 78.6h37l-6.6-17H38.1z" />
      <path d="M21.6 91.4h56.8V78.6H21.6z" data-detail="pawn-base" />
      <path d="M36.2 61.6c5.4 3.4 22.2 3.4 27.6 0" fill="none" data-detail="pawn-collar" />
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
