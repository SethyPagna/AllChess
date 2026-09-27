import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { resolveAppearancePreset } from "@/components/board/appearance";
import { collectionModelPath } from "@/components/board/board-3d-config";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { PieceIcon, getPieceSkinOptions, resolvePieceSkin } from "@/components/board/piece-icon";
import { piece2DSkin, piece2DStyleOptions, pieceSetModelPath, pieceSetOptions, readPiece2DStylePreference, readPieceSetPreference, resolvePiece2DStyle, resolvePieceSet } from "@/components/board/piece-sets";
import { applyMove, createInitialState, getLegalMoves } from "@/lib/variants";

const roles = [
  ["g", "general", "General", "帥", "將"], ["a", "advisor", "Advisor", "仕", "士"],
  ["e", "elephant", "Elephant", "相", "象"], ["h", "horse", "Horse", "傌", "馬"],
  ["r", "chariot", "Chariot", "俥", "車"], ["c", "cannon", "Cannon", "炮", "砲"],
  ["p", "soldier", "Soldier", "兵", "卒"]
] as const;

describe("Xiangqi coordinated collections", () => {
  test("existing and unset choices retain Boxwood, while Celadon resolves only for Xiangqi", () => {
    expect(pieceSetOptions("xiangqi")).toEqual([
      { key: "standard", label: "Boxwood", skin: "disc", finishLabel: "Boxwood" },
      { key: "celadon", label: "Celadon", skin: "celadon", finishLabel: "Celadon glaze" }
    ]);
    for (const value of [null, undefined, "standard", "hori", "courtyard", "../celadon.glb", ""]) expect(resolvePieceSet("xiangqi", value)).toBe("standard");
    expect(resolvePieceSet("xiangqi", "celadon")).toBe("celadon");
    expect(pieceSetModelPath("xiangqi", "celadon")).toBe("/assets/xiangqi/celadon.glb");
    expect(pieceSetModelPath("xiangqi", "standard") ?? collectionModelPath("xiangqi")).toBe("/assets/xiangqi/collection.glb");
    for (const family of ["janggi", "shogi", "khmer", "draughts", "classic"] as const) expect(pieceSetModelPath(family, "celadon")).toBeUndefined();
    for (const game of ["janggi", "shogi", "mini-shogi", "ouk-chaktrang", "classic"]) {
      expect(resolvePieceSet(game, "celadon")).toBe("standard");
      expect(resolvePieceSkin(game, "celadon")).not.toBe("celadon");
      expect(getPieceSkinOptions(game).some(option => option.key === "celadon")).toBe(false);
    }
    expect(pieceSetOptions("janggi")).toEqual([]);
    expect(piece2DStyleOptions("janggi")).toEqual([]);
  });

  test.each(roles)("%s retains both native faces and accessible identities across all 2D styles", (code, asset, label, red, black) => {
    for (const owner of ["red", "black"] as const) {
      const artwork = renderToStaticMarkup(<PieceIcon code={code} owner={owner} variantKey="xiangqi" pieceSkin="celadon"/>);
      expect(artwork).toContain(`/assets/xiangqi/celadon/${owner}-${asset}.webp`);
      expect(artwork).toContain(`data-owner="${owner}"`);
      expect(artwork).toContain(`aria-label="${label}"`);
      expect(artwork).not.toContain("transform=");
      expect(artwork).not.toContain("data-promoted=");
      for (const style of ["clear", "letters"] as const) {
        const html = renderToStaticMarkup(<PieceIcon code={code} owner={owner} variantKey="xiangqi" pieceSkin={piece2DSkin("xiangqi", "celadon", "default", style)}/>);
        expect(html).toContain(owner === "red" ? red : black);
        expect(html).toContain(`aria-label="${label}"`);
        expect(html).toContain(`data-skin="${style === "clear" ? "disc" : "tile"}"`);
      }
    }
  });

  test("a crossed-river soldier does not acquire a foreign promotion face", () => {
    const state = createInitialState("xiangqi");
    state.board[5][0].piece = state.board[6][0].piece;
    state.board[6][0].piece = null;
    const move = getLegalMoves(state, { row: 5, col: 0 }).find(move => move.to.row === 4 && move.to.col === 0)!;
    expect(move).toBeDefined();
    const crossed = applyMove(state, move).board[4][0].piece!;
    expect(crossed.code).toBe("p");
    expect(crossed.promoted).toBeFalsy();
    for (const style of ["collection", "clear", "letters"] as const) {
      const html = renderToStaticMarkup(<PieceIcon code={crossed.code} owner={crossed.owner} variantKey="xiangqi" pieceSkin={piece2DSkin("xiangqi", "celadon", "default", style)} promoted={crossed.promoted}/>);
      expect(html).toContain('aria-label="Soldier"');
      expect(html).not.toContain("promoted-");
      expect(html).not.toContain("data-promoted=");
      if (style === "collection") expect(html).toContain("/assets/xiangqi/celadon/red-soldier.webp");
      else expect(html).toContain("兵");
    }
  });

  test.each([["tablet", "letters"], ["contrast", "clear"], ["disc", "collection"], ["default", "collection"]] as const)("migrates legacy %s once without changing the selected collection or Janggi", (legacy, expected) => {
    const stored = new Map<string, string>([
      ["allchess-appearance-set:xiangqi", legacy], ["allchess-piece-set:xiangqi", "celadon"],
      ["allchess-appearance-set:janggi", "tablet"], ["allchess-piece-set:janggi", "celadon"]
    ]);
    const read = (key: string) => stored.get(key) ?? null;
    const write = (key: string, value: string) => { stored.set(key, value); };
    expect(readPiece2DStylePreference("xiangqi", read, write)).toBe(expected);
    expect(stored.get("allchess-piece-2d-style:xiangqi")).toBe(expected);
    stored.set("allchess-appearance-set:xiangqi", "slate");
    expect(readPiece2DStylePreference("xiangqi", read, write)).toBe(expected);
    expect(readPieceSetPreference("xiangqi", read)).toBe("celadon");
    expect(readPieceSetPreference("janggi", read)).toBe("standard");
    expect(readPiece2DStylePreference("janggi", read, write)).toBe("collection");
    expect(stored.has("allchess-piece-2d-style:janggi")).toBe(false);
    expect(stored.get("allchess-appearance-set:janggi")).toBe("tablet");
    stored.set("allchess-piece-2d-style:xiangqi", "collection");
    stored.set("allchess-appearance-set:xiangqi", "tablet");
    expect(readPiece2DStylePreference("xiangqi", read, write)).toBe("collection");
  });

  test("guards blocked and corrupt preferences independently", () => {
    const blocked = () => { throw new Error("Storage unavailable"); };
    expect(readPieceSetPreference("xiangqi", blocked)).toBe("standard");
    expect(readPiece2DStylePreference("xiangqi", blocked, blocked)).toBe("collection");
    expect(readPieceSetPreference("xiangqi", key => key === "allchess-piece-set:xiangqi" ? "celadon" : blocked())).toBe("celadon");
    for (const style of ["collection", "clear", "letters"] as const) expect(readPiece2DStylePreference("xiangqi", key => key === "allchess-piece-2d-style:xiangqi" ? style : blocked(), blocked)).toBe(style);
    for (const value of ["", "tile", "tablet", "celadon", "../invalid"]) expect(resolvePiece2DStyle("xiangqi", value, "tablet")).toBe("collection");
    const writes: string[] = [];
    expect(readPiece2DStylePreference("xiangqi", key => key === "allchess-piece-2d-style:xiangqi" ? null : blocked(), key => writes.push(key))).toBe("collection");
    expect(writes).toEqual([]);
    expect(readPiece2DStylePreference("xiangqi", key => key === "allchess-appearance-set:xiangqi" ? "tablet" : null, blocked)).toBe("letters");
  });

  test("Artwork, Clear and Letters remain independent across every collection and board colour", () => {
    for (const set of ["standard", "celadon"] as const) for (const theme of ["default", "wood", "slate", "plum", "contrast", "tablet"] as const) {
      const fallback = resolveAppearancePreset("xiangqi", theme).pieceSkin;
      expect(piece2DSkin("xiangqi", set, fallback, "collection")).toBe(set === "celadon" ? "celadon" : "disc");
      expect(piece2DSkin("xiangqi", set, fallback, "clear")).toBe("disc");
      expect(piece2DSkin("xiangqi", set, fallback, "letters")).toBe("tile");
    }
  });

  test("compact picker shows both native owners, with readability controls only in 2D", () => {
    const toolbar = (is3D = false) => renderToStaticMarkup(<BoardToolbar variantKey="xiangqi" pieceSet="celadon" piece2DStyle="letters" onPiece2DStyleChange={() => {}} appearancePreset="wood" onAppearanceChange={() => {}} onFlip={() => {}} focusMode={false} onFocusChange={() => {}} canFocus={false} onPieceSetChange={() => {}} is3D={is3D}/>);
    const html = toolbar();
    expect(html).toContain('data-collection-count="2"');
    expect(html).toContain('aria-label="Choose Boxwood pieces" aria-pressed="false"');
    expect(html).toContain('aria-label="Choose Celadon pieces" aria-pressed="true"');
    expect(html).toContain('/assets/xiangqi/celadon/red-general.webp');
    expect(html).toContain('/assets/xiangqi/celadon/black-horse.webp');
    expect(html).toContain('aria-label="Use Letters pieces" aria-pressed="true"');
    expect(html).toContain('data-piece-set="celadon"');
    expect(html).not.toContain('data-code="k"');
    expect(html).not.toContain('/red-soldier.webp');
    expect(toolbar(true)).not.toContain('aria-label="2D piece style"');
  });
});
