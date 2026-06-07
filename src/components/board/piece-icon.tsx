import { normalizeLocale, type LocaleCode } from "@/lib/i18n/locales";
import { getVocabulary } from "@/lib/i18n/vocabulary";
import type { PlayerColor } from "@/lib/variants";

type PieceIconProps = {
  code: string;
  owner: PlayerColor;
  pieceSkin?: PieceSkinPreference;
  variantKey: string;
  locale?: string;
  promoted?: boolean;
};

export type PieceSkin = "western" | "glyph" | "monogram" | "makruk" | "disc" | "wedge" | "mini-wedge" | "tile" | "checker" | "stone";
export type PieceSkinPreference = "default" | PieceSkin;

export type PieceSkinOption = {
  key: PieceSkinPreference;
  label: string;
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

export function PieceIcon({ code, owner, pieceSkin = "default", variantKey, locale = "en", promoted = false }: PieceIconProps) {
  const normalized = code.toLowerCase();
  const label = getPieceDisplayName(normalized, variantKey, locale, promoted);
  const skin = resolvePieceSkin(variantKey, pieceSkin);
  if (isDraughtsPresentation(variantKey)) {
    return <DraughtsPieceIcon code={normalized} owner={owner} promoted={promoted} variantKey={variantKey} label={label} skin={skin} />;
  }
  if (isStonePresentation(variantKey)) {
    return <StonePieceIcon owner={owner} variantKey={variantKey} label={label} skin={skin} />;
  }
  if (usesWesternPresentation(variantKey)) {
    if (skin === "glyph") return <WesternGlyphIcon code={normalized} owner={owner} variantKey={variantKey} promoted={promoted} label={label} />;
    if (skin === "monogram") return <WesternMonogramIcon code={normalized} owner={owner} variantKey={variantKey} promoted={promoted} label={label} />;
    return <WesternPieceIcon code={normalized} owner={owner} variantKey={variantKey} promoted={promoted} label={label} skin={skin} />;
  }

  const glyph = getNativeGlyph({ code: normalized, owner, variantKey, promoted });

  return (
    <span
      aria-label={label}
      className="piece-symbol piece-icon native-piece-symbol"
      data-owner={owner}
      data-piece="native"
      data-piece-label={label}
      data-code={normalized}
      data-skin={skin}
      data-variant={variantKey}
      data-promoted={promoted || undefined}
      role="img"
      title={label}
    >
      {glyph}
    </span>
  );
}

function DraughtsPieceIcon({ code, owner, promoted, variantKey, label, skin }: { code: string; owner: PlayerColor; promoted: boolean; variantKey: string; label: string; skin: PieceSkin }) {
  const isKing = code === "x" || promoted;
  const piece = isKing ? "checker-king" : "checker-man";
  return (
    <svg
      aria-label={label}
      className="piece-symbol piece-icon piece-svg"
      data-owner={owner}
      data-piece={piece}
      data-piece-label={label}
      data-promoted={isKing || undefined}
      data-skin={skin}
      data-variant={variantKey}
      role="img"
      viewBox="0 0 100 100"
    >
      <title>{label}</title>
      <ellipse cx="50" cy="67" rx="33" ry="16" data-detail="checker-shadow" />
      <ellipse cx="50" cy="56" rx="35" ry="20" data-detail="checker-rim" />
      <ellipse cx="50" cy="45" rx="34" ry="20" data-detail="checker-top" />
      <path d="M22 53c6 12 18 19 28 19s22-7 28-19v14c-5 13-18 22-28 22S27 80 22 67z" data-detail="checker-side" />
      {isKing ? <path d="M34 46 42 32l8 13 8-13 8 14-7 10H41z" data-detail="checker-crown" /> : null}
    </svg>
  );
}

function isDraughtsPresentation(variantKey: string) {
  return variantKey === "english-draughts" || variantKey === "international-draughts" || variantKey === "turkish-draughts";
}

function isStonePresentation(variantKey: string) {
  return variantKey === "konane";
}

function StonePieceIcon({ owner, variantKey, label, skin }: { owner: PlayerColor; variantKey: string; label: string; skin: PieceSkin }) {
  return (
    <svg
      aria-label={label}
      className="piece-symbol piece-icon piece-svg"
      data-owner={owner}
      data-piece="stone"
      data-piece-label={label}
      data-skin={skin}
      data-variant={variantKey}
      role="img"
      viewBox="0 0 100 100"
    >
      <title>{label}</title>
      <circle cx="50" cy="55" r="34" data-detail="stone-shadow" />
      <circle cx="50" cy="48" r="34" data-detail="stone-face" />
      <path d="M30 36c10-10 29-13 43-1" fill="none" data-detail="stone-highlight" />
    </svg>
  );
}

function usesWesternPresentation(variantKey: string) {
  return ["classic", "chess960", "antichess", "horde", "king-of-the-hill", "three-check", "racing-kings", "makruk"].includes(variantKey);
}

function WesternPieceIcon({ code, owner, variantKey, promoted, label, skin }: { code: string; owner: PlayerColor; variantKey: string; promoted: boolean; label: string; skin: PieceSkin }) {
  const piece = westernPieceName(code, variantKey);
  return (
    <svg
      aria-label={label}
      className="piece-symbol piece-icon piece-svg"
      data-owner={owner}
      data-piece={piece}
      data-piece-label={label}
      data-code={code}
      data-promoted={promoted || undefined}
      data-skin={skin}
      data-variant={variantKey}
      role="img"
      viewBox="0 0 100 100"
    >
      <title>{label}</title>
      {piece === "king" ? <KingPaths /> : null}
      {piece === "queen" ? <QueenPaths /> : null}
      {piece === "rook" ? <RookPaths /> : null}
      {piece === "bishop" ? <BishopPaths /> : null}
      {piece === "knight" ? <KnightPaths /> : null}
      {piece === "pawn" ? <PawnPaths /> : null}
    </svg>
  );
}

function WesternGlyphIcon({ code, owner, variantKey, promoted, label }: { code: string; owner: PlayerColor; variantKey: string; promoted: boolean; label: string }) {
  const piece = westernPieceName(code, variantKey);
  return (
    <span
      aria-label={label}
      className="piece-symbol piece-icon western-glyph-piece"
      data-owner={owner}
      data-piece={`${piece}-glyph`}
      data-piece-label={label}
      data-code={code}
      data-promoted={promoted || undefined}
      data-skin="glyph"
      data-variant={variantKey}
      role="img"
      title={label}
    >
      {westernGlyph(piece, owner)}
    </span>
  );
}

function WesternMonogramIcon({ code, owner, variantKey, promoted, label }: { code: string; owner: PlayerColor; variantKey: string; promoted: boolean; label: string }) {
  const piece = westernPieceName(code, variantKey);
  return (
    <span
      aria-label={label}
      className="piece-symbol piece-icon western-monogram-piece"
      data-owner={owner}
      data-piece={`${piece}-monogram`}
      data-piece-label={label}
      data-code={code}
      data-promoted={promoted || undefined}
      data-skin="monogram"
      data-variant={variantKey}
      role="img"
      title={label}
    >
      <span aria-hidden="true" className="western-monogram-letter">
        {westernMonogram(piece, code, variantKey)}
      </span>
    </span>
  );
}

function westernGlyph(piece: string, owner: PlayerColor) {
  const isDark = owner === "black" || owner === "blue" || owner === "gote";
  const lightGlyphs: Record<string, string> = {
    king: "\u2654",
    queen: "\u2655",
    rook: "\u2656",
    bishop: "\u2657",
    knight: "\u2658",
    pawn: "\u2659"
  };
  const darkGlyphs: Record<string, string> = {
    king: "\u265a",
    queen: "\u265b",
    rook: "\u265c",
    bishop: "\u265d",
    knight: "\u265e",
    pawn: "\u265f"
  };
  return (isDark ? darkGlyphs : lightGlyphs)[piece] ?? (isDark ? "\u265f" : "\u2659");
}

function westernMonogram(piece: string, code: string, variantKey: string) {
  if (variantKey === "makruk") {
    const makrukLetters: Record<string, string> = {
      k: "K",
      m: "M",
      s: "S",
      n: "N",
      r: "R",
      p: "P"
    };
    return makrukLetters[code] ?? code.toUpperCase();
  }
  const letters: Record<string, string> = {
    king: "K",
    queen: "Q",
    rook: "R",
    bishop: "B",
    knight: "N",
    pawn: "P"
  };
  return letters[piece] ?? code.toUpperCase();
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
  if (isShogiPresentation(variantKey)) {
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

export function getPieceSkin(variantKey: string): PieceSkin {
  if (variantKey === "makruk") return "makruk";
  if (isDraughtsPresentation(variantKey)) return "checker";
  if (isStonePresentation(variantKey)) return "stone";
  if (variantKey === "xiangqi" || variantKey === "janggi") return "disc";
  if (variantKey === "mini-shogi") return "mini-wedge";
  if (variantKey === "shogi") return "wedge";
  if (variantKey === "jungle") return "tile";
  return "western";
}

export function getPieceSkinOptions(variantKey: string): PieceSkinOption[] {
  const defaultSkin = getPieceSkin(variantKey);
  const defaults: PieceSkinOption[] = [{ key: "default", label: `Auto (${pieceSkinLabel(defaultSkin)})` }];
  if (variantKey === "shogi" || variantKey === "mini-shogi") {
    return [...defaults, option("wedge"), option("mini-wedge"), option("tile")];
  }
  if (variantKey === "xiangqi" || variantKey === "janggi") {
    return [...defaults, option("disc"), option("tile")];
  }
  if (variantKey === "jungle") {
    return [...defaults, option("tile"), option("disc")];
  }
  if (isDraughtsPresentation(variantKey)) {
    return [...defaults, option("checker"), option("stone")];
  }
  if (isStonePresentation(variantKey)) {
    return [...defaults, option("stone"), option("checker")];
  }
  if (variantKey === "makruk") {
    return [...defaults, option("makruk"), option("western"), option("glyph"), option("monogram")];
  }
  return [...defaults, option("western"), option("glyph"), option("monogram"), option("makruk")];
}

export function resolvePieceSkin(variantKey: string, preference: PieceSkinPreference = "default"): PieceSkin {
  if (preference === "default") return getPieceSkin(variantKey);
  const allowed = new Set(getPieceSkinOptions(variantKey).map((skin) => skin.key));
  return allowed.has(preference) ? preference : getPieceSkin(variantKey);
}

export function getPieceDisplayName(code: string, variantKey: string, locale = "en", promoted = false) {
  const normalizedLocale = normalizeLocale(locale);
  const vocabulary = getVocabulary(normalizedLocale);
  const promotedKey = promoted ? promotedPieceVocabularyKey(code, variantKey) : null;
  if (promotedKey) return promotedPieceDisplayName(promotedKey, normalizedLocale, vocabulary.pieces[promotedKey] ?? promotedKey);
  const key = pieceVocabularyKey(code, variantKey, promoted);
  const fallbackKey = pieceVocabularyKey(code, "classic", false);
  const base = vocabulary.pieces[key] ?? vocabulary.pieces[fallbackKey] ?? code.toUpperCase();
  return promoted ? `${vocabulary.pieces.promoted} ${base}` : base;
}

function promotedPieceDisplayName(key: string, locale: LocaleCode, fallback: string) {
  const localized: Partial<Record<LocaleCode, Record<string, string>>> = {
    ja: {
      dragonKing: "\u9f8d",
      dragonHorse: "\u99ac",
      promotedSilver: "\u5168",
      promotedKnight: "\u572d",
      promotedLance: "\u674f",
      tokin: "\u3068"
    },
    "zh-CN": {
      dragonKing: "\u9f99\u738b",
      dragonHorse: "\u9f99\u9a6c",
      promotedSilver: "\u6210\u94f6",
      promotedKnight: "\u6210\u6842",
      promotedLance: "\u6210\u9999",
      tokin: "\u3068\u91d1"
    },
    "zh-TW": {
      dragonKing: "\u9f8d\u738b",
      dragonHorse: "\u9f8d\u99ac",
      promotedSilver: "\u6210\u9280",
      promotedKnight: "\u6210\u6842",
      promotedLance: "\u6210\u9999",
      tokin: "\u3068\u91d1"
    }
  };
  return localized[locale]?.[key] ?? fallback;
}

function promotedPieceVocabularyKey(code: string, variantKey: string): string | null {
  if (variantKey !== "shogi" && variantKey !== "mini-shogi") return null;
  const names: Record<string, string> = {
    r: "dragonKing",
    b: "dragonHorse",
    s: "promotedSilver",
    n: "promotedKnight",
    l: "promotedLance",
    p: "tokin"
  };
  return names[code] ?? null;
}

function pieceVocabularyKey(code: string, variantKey: string, promoted: boolean): string {
  if (isDraughtsPresentation(variantKey)) return code === "x" || promoted ? "checkerKing" : "checkerMan";
  if (isStonePresentation(variantKey)) return "stone";
  if (variantKey === "xiangqi") {
    const names: Record<string, string> = { g: "general", a: "advisor", e: "elephant", h: "horse", r: "chariot", c: "cannon", p: "soldier" };
    return names[code] ?? "piece";
  }
  if (variantKey === "janggi") {
    const names: Record<string, string> = { g: "general", a: "guard", e: "elephant", h: "horse", r: "chariot", c: "cannon", p: "soldier" };
    return names[code] ?? "piece";
  }
  if (variantKey === "shogi" || variantKey === "mini-shogi") {
    const names: Record<string, string> = { k: "king", r: "rook", b: "bishop", g: "goldGeneral", s: "silverGeneral", n: "knight", l: "lance", p: "pawn" };
    return names[code] ?? "piece";
  }
  if (variantKey === "jungle") {
    const names: Record<string, string> = { e: "elephant", l: "lion", t: "tiger", p: "leopard", w: "wolf", d: "dog", c: "cat", r: "rat" };
    return names[code] ?? "piece";
  }
  if (variantKey === "makruk") {
    const names: Record<string, string> = { k: "king", m: "met", s: "khon", n: "knight", r: "rook", p: "pawn" };
    return names[code] ?? "piece";
  }
  const names: Record<string, string> = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn", f: "ferz", m: "minister", a: "alfil", e: "elephant" };
  return names[code] ?? "piece";
}

function isShogiPresentation(variantKey: string) {
  return variantKey === "shogi" || variantKey === "mini-shogi";
}

function option(key: PieceSkin): PieceSkinOption {
  return { key, label: pieceSkinLabel(key) };
}

function pieceSkinLabel(key: PieceSkin) {
  const labels: Record<PieceSkin, string> = {
    western: "Classic",
    glyph: "Glyph",
    monogram: "Monogram",
    makruk: "Warm",
    disc: "Disc",
    wedge: "Wedge",
    "mini-wedge": "Compact",
    tile: "Tile",
    checker: "Checker",
    stone: "Stone"
  };
  return labels[key];
}

function westernPieceName(code: string, variantKey: string) {
  if (variantKey === "makruk") {
    const makrukNames: Record<string, string> = {
      k: "king",
      m: "queen",
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
