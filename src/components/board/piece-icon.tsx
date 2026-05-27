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
      <path d="M46.2 7.5h7.6v10.7h10.7v7.5H53.8v9.8h-7.6v-9.8H35.5v-7.5h10.7z" data-detail="king-cross" />
      <path d="M34.8 62.2c1.2-13.4 7.4-23.2 15.2-23.2s14 9.8 15.2 23.2z" />
      <path d="M25.8 64.8c3.8-4.8 9.8-7.5 24.2-7.5s20.4 2.7 24.2 7.5l-6.7 12.7h-35z" data-detail="king-shoulders" />
      <path d="M28.4 79.2h43.2l4.7 12.2H23.7z" data-detail="king-base" />
      <path d="M34.1 69.2c5.8 3.1 25.8 3.1 31.8 0" fill="none" data-detail="king-collar" />
    </>
  );
}

function QueenPaths() {
  return (
    <>
      <circle cx="18.2" cy="28.7" r="5.6" data-detail="queen-jewel" />
      <circle cx="34.3" cy="17.8" r="5.2" data-detail="queen-jewel" />
      <circle cx="50" cy="13.6" r="5.9" data-detail="queen-jewel" />
      <circle cx="65.7" cy="17.8" r="5.2" data-detail="queen-jewel" />
      <circle cx="81.8" cy="28.7" r="5.6" data-detail="queen-jewel" />
      <path d="M19.8 39.6 31.6 66.4h36.8l11.8-26.8-20.1 11.8L50 26.4 39.9 51.4z" data-detail="queen-coronet" />
      <path d="M34.4 68.2h31.2l4.4 10.6H30z" data-detail="queen-neck" />
      <path d="M23.5 91.4h53l-4.8-12.6H28.3z" data-detail="queen-base" />
      <path d="M35.8 66.6c6.2 3.2 22.2 3.2 28.4 0" fill="none" data-detail="queen-collar" />
    </>
  );
}

function RookPaths() {
  return (
    <>
      <path d="M21 16.8h14.8v10.5h8.8V16.8h10.8v10.5h8.8V16.8H79v25.4H21z" data-detail="rook-turrets" />
      <path d="M27.4 42.2h45.2l-4.2 36.1H31.6z" data-detail="rook-tower" />
      <path d="M22.6 91.4h54.8l-5.2-13.1H27.8z" data-detail="rook-base" />
      <path d="M31.2 53.4h37.6M30.5 64.1h39" fill="none" data-detail="rook-stone-course" />
    </>
  );
}

function BishopPaths() {
  return (
    <>
      <path d="M50 10.2c12.6 9.2 20.9 21.5 20.9 34.6 0 12.1-7.6 21.8-20.9 22.4-13.3-.6-20.9-10.3-20.9-22.4 0-13.1 8.3-25.4 20.9-34.6z" data-detail="bishop-mitre" />
      <path d="M59.5 25.5 42.4 56.6" fill="none" stroke="var(--piece-cutout)" strokeWidth="8" data-detail="bishop-mitre-slit" />
      <path d="M36.8 67.6h26.4l5.8 11.5H31z" data-detail="bishop-neck" />
      <path d="M24.2 91.4h51.6l-6.8-12.3H31z" data-detail="bishop-base" />
      <path d="M37.6 68.2c6.3 3.2 18.5 3.2 24.8 0" fill="none" data-detail="bishop-collar" />
    </>
  );
}

function KnightPaths() {
  return (
    <>
      <path d="M24.4 85.8h51.2c-5.2-11.2-8.9-22.1-8.9-36.9 0-16.4-10.8-28.4-29.8-33.5L27.4 26l9.8 5.8-14.7 11.5c-5.3 4.8-7 12.4-4.4 18.9l13.5-6.2c2.1 9.4-.2 19.4-7.2 29.8z" data-detail="knight-head" />
      <path d="M38 16.6c4.3 7 5.4 12.3 3.7 18.6M51.2 23.8c4.2 7.8 4.8 15.6 2.2 23.2" fill="none" data-detail="knight-mane" />
      <path d="M43.4 30.3c2.3 0 4.1 1.6 4.1 3.8s-1.8 3.8-4.1 3.8-4.1-1.6-4.1-3.8 1.8-3.8 4.1-3.8z" fill="var(--piece-cutout)" stroke="var(--piece-cutout)" data-detail="knight-eye" />
      <path d="M51 45.4c-5.7 4-11.3 5.2-16.6 3.5" fill="none" data-detail="knight-muzzle" />
      <path d="M23 94h54l-3.5-8.2h-47z" data-detail="knight-base" />
    </>
  );
}

function PawnPaths() {
  return (
    <>
      <circle cx="50" cy="25.8" r="13.1" data-detail="pawn-head" />
      <path d="M37.8 47.5h24.4l5.3 12.2h-35z" data-detail="pawn-neck" />
      <path d="M31.8 78.1h36.4l-6.1-18.4H37.9z" data-detail="pawn-body" />
      <path d="M22.2 91.4h55.6l-6.2-13.3H28.4z" data-detail="pawn-base" />
      <path d="M35.8 60.1c6.1 3.2 22.3 3.2 28.4 0" fill="none" data-detail="pawn-collar" />
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
