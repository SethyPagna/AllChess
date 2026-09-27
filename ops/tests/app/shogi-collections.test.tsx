import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { BoardPlayerCard } from "@/components/board/board-player-card";
import { PromotionChoiceCard } from "@/components/board/game-board";
import { PieceIcon, resolvePieceSkin } from "@/components/board/piece-icon";
import { piece2DSkin, piece2DStyleOptions, pieceSetModelPath, pieceSetOptions, pieceSetPreviewPieces, readPiece2DStylePreference, readPieceSetPreference, resolvePiece2DStyle, resolvePieceSet } from "@/components/board/piece-sets";
import { resolveAppearancePreset } from "@/components/board/appearance";
import { collectionModelPath, shogiPromotedCodes } from "@/components/board/board-3d-config";
import { applyMove, createInitialState, getLegalMoves } from "@/lib/variants";

const games = ["shogi", "mini-shogi"] as const;
const names = { k: "king", r: "rook", b: "bishop", g: "gold", s: "silver", n: "knight", l: "lance", p: "pawn" };

describe("native Shogi collections", () => {
  test.each(games)("%s keeps its Printed default and independent readability choices", variantKey => {
    const printedSkin = variantKey === "mini-shogi" ? "mini-wedge" : "wedge";
    expect(pieceSetOptions(variantKey)).toEqual([
      { key: "standard", label: "Printed", skin: printedSkin, finishLabel: "Boxwood" },
      { key: "hori", label: "Carved", skin: "hori", finishLabel: "Honey boxwood" }
    ]);
    for (const value of [null, undefined, "", "carved", "courtyard", "club", "../hori.glb"]) expect(resolvePieceSet(variantKey, value)).toBe("standard");
    expect(resolvePieceSet(variantKey, "hori")).toBe("hori");
    expect(pieceSetModelPath("shogi", "hori")).toBe("/assets/shogi/hori.glb");
    expect(pieceSetModelPath("shogi", "standard") ?? collectionModelPath("shogi")).toBe("/assets/shogi/collection.glb");
    expect(pieceSetPreviewPieces(variantKey)).toEqual([{ code: "k" }, { code: "r", promoted: true }]);
    for (const preset of ["default", "carved", "tablet", "contrast", "slate", "plum"] as const) {
      const fallback = resolveAppearancePreset(variantKey, preset).pieceSkin;
      expect(piece2DSkin(variantKey, "hori", fallback, "collection")).toBe("hori");
      expect(piece2DSkin(variantKey, "standard", fallback, "collection")).toBe(printedSkin);
      for (const set of ["standard", "hori"] as const) {
        expect(piece2DSkin(variantKey, set, fallback, "letters")).toBe("tile");
        expect(piece2DSkin(variantKey, set, fallback, "clear")).toBe(printedSkin);
      }
    }
  });

  test.each(games)("%s preserves legacy presets once without treating the old carved preset as a new collection", variantKey => {
    for (const [legacy, expected] of [["tablet", "letters"], ["contrast", "clear"], ["carved", "collection"], ["default", "collection"], ["plum", "collection"]] as const) {
      const stored = new Map([[`allchess-appearance-set:${variantKey}`, legacy as string]]);
      const read = (key: string) => stored.get(key) ?? null;
      const write = (key: string, value: string) => { stored.set(key, value); };
      expect(readPiece2DStylePreference(variantKey, read, write)).toBe(expected);
      expect(readPieceSetPreference(variantKey, read)).toBe("standard");
      stored.set(`allchess-appearance-set:${variantKey}`, "slate");
      expect(readPiece2DStylePreference(variantKey, read, write)).toBe(expected);
      stored.set(`allchess-piece-2d-style:${variantKey}`, "collection");
      stored.set(`allchess-piece-set:${variantKey}`, "hori");
      stored.set(`allchess-appearance-set:${variantKey}`, "tablet");
      expect(readPiece2DStylePreference(variantKey, read, write)).toBe("collection");
      expect(readPieceSetPreference(variantKey, read)).toBe("hori");
    }
  });

  test("Shogi and Mini Shogi preferences stay isolated and tolerate unavailable storage", () => {
    const stored = new Map([
      ["allchess-piece-set:shogi", "hori"], ["allchess-piece-set:mini-shogi", "standard"],
      ["allchess-piece-2d-style:shogi", "letters"], ["allchess-piece-2d-style:mini-shogi", "clear"],
      ["allchess-piece-set:ouk-chaktrang", "courtyard"], ["allchess-piece-set:english-draughts", "club"]
    ]);
    const read = (key: string) => stored.get(key) ?? null;
    const blocked = () => { throw new Error("Storage is unavailable"); };
    expect(readPieceSetPreference("shogi", read)).toBe("hori");
    expect(readPieceSetPreference("mini-shogi", read)).toBe("standard");
    expect(readPiece2DStylePreference("shogi", read, blocked)).toBe("letters");
    expect(readPiece2DStylePreference("mini-shogi", read, blocked)).toBe("clear");
    for (const variantKey of games) {
      expect(readPieceSetPreference(variantKey, blocked)).toBe("standard");
      expect(readPiece2DStylePreference(variantKey, blocked, blocked)).toBe("collection");
      expect(readPiece2DStylePreference(variantKey, key => key.startsWith("allchess-appearance-set:") ? "tablet" : null, blocked)).toBe("letters");
      expect(readPiece2DStylePreference(variantKey, key => key.startsWith("allchess-piece-2d-style:") ? "clear" : blocked(), blocked)).toBe("clear");
      expect(resolvePiece2DStyle(variantKey, "invalid", "tablet")).toBe("collection");
    }
    expect(readPieceSetPreference("ouk-chaktrang", read)).toBe("courtyard");
    expect(readPieceSetPreference("english-draughts", read)).toBe("club");
    for (const variantKey of ["classic", "ouk-chaktrang", "xiangqi", "janggi", "english-draughts"]) {
      expect(resolvePieceSet(variantKey, "hori")).toBe(variantKey === "english-draughts" ? "rosette" : "standard");
      expect(resolvePieceSkin(variantKey, "hori")).not.toBe("hori");
    }
    for (const family of ["classic", "khmer", "xiangqi", "janggi", "draughts"] as const) expect(pieceSetModelPath(family, "hori")).toBeUndefined();
  });

  test.each(games)("%s maps every base and promoted face without a Western pawn fallback", variantKey => {
    const used = new Set<string>();
    for (const owner of ["sente", "gote"] as const) for (const [code, name] of Object.entries(names)) {
      for (const promoted of [false, true]) {
        const face = code === "k" && owner === "sente" ? "king-jewel" : `${promoted && shogiPromotedCodes.has(code) ? "promoted-" : ""}${name}`;
        const html = renderToStaticMarkup(<PieceIcon variantKey={variantKey} pieceSkin="hori" code={code} owner={owner} promoted={promoted}/>);
        expect(html).toContain(`/assets/shogi/hori/${face}.webp`);
        expect(html).toContain(`data-owner="${owner}"`);
        expect(html).toContain(`data-code="${code}"`);
        expect(html).toContain('data-skin="hori"');
        expect(html).not.toContain('<circle');
        expect(html).not.toContain('/assets/classic/');
        used.add(face);
      }
    }
    expect(used.size).toBe(15);
    expect([...used]).not.toContain("promoted-gold");
    expect([...used]).not.toContain("promoted-king");
  });

  test.each(games)("%s offers genuine collection previews and keeps readability controls out of 3D", variantKey => {
    const render = (is3D = false) => renderToStaticMarkup(<BoardToolbar variantKey={variantKey} pieceSet="hori" piece2DStyle="letters" onPiece2DStyleChange={() => {}} appearancePreset="slate" onAppearanceChange={() => {}} onFlip={() => {}} focusMode={false} onFocusChange={() => {}} canFocus={false} onPieceSetChange={() => {}} is3D={is3D}/>);
    const html = render();
    expect(piece2DStyleOptions(variantKey).map(style => style.key)).toEqual(["collection", "clear", "letters"]);
    expect(html).toContain('aria-label="Choose Printed pieces" aria-pressed="false"');
    expect(html).toContain('aria-label="Choose Carved pieces" aria-pressed="true"');
    expect(html).toContain('data-collection-count="2"');
    expect(html).toContain('/assets/shogi/hori/king-jewel.webp');
    expect(html).toContain('/assets/shogi/hori/promoted-rook.webp');
    expect(html).toContain('aria-label="Use Letters pieces" aria-pressed="true"');
    expect(render(true)).not.toContain('aria-label="2D piece style"');
  });

  test("Hori keeps the native tile size hierarchy when swapping to a promoted face", () => {
    const size = (code: string, promoted = false) => {
      const html = renderToStaticMarkup(<PieceIcon variantKey="shogi" pieceSkin="hori" code={code} owner="sente" promoted={promoted}/>);
      return Number(html.match(/<image[^>]*height="([\d.]+)"/)?.[1]);
    };
    expect(size("k")).toBe(100);
    const widths = ["k", "r", "g", "n", "l", "p"].map(code => size(code));
    expect(widths.every((value, index) => index === 0 || value < widths[index - 1])).toBe(true);
    for (const code of shogiPromotedCodes) expect(size(code, true)).toBe(size(code));
  });

  test.each(games)("%s promotion choices display both actual Hori faces and localized names", variantKey => {
    const html = renderToStaticMarkup(<PromotionChoiceCard locale="ja" onChoose={() => {}} pieceCode="b" pieceLabel="角" pieceOwner="gote" pieceSkin="hori" promotedPieceLabel="馬" variantKey={variantKey}/>);
    expect(html).toContain('/assets/shogi/hori/bishop.webp');
    expect(html).toContain('/assets/shogi/hori/promoted-bishop.webp');
    expect(html).toContain('data-owner="gote"');
    expect(html).toContain('aria-label="馬"');
    expect(html).not.toContain('/assets/classic/');
  });

  test("a captured promoted tile shows its unpromoted Hori face in the new owner's hand", () => {
    const state = createInitialState("mini-shogi");
    for (const cell of state.board.flat()) if (cell.piece?.code !== "k") cell.piece = null;
    state.board[3][2].piece = { id: "capturing-rook", code: "r", owner: "sente", labelKey: "piece.r" };
    state.board[2][2].piece = { id: "promoted-pawn", code: "p", owner: "gote", promoted: true, labelKey: "piece.p" };
    const capture = getLegalMoves(state, { row: 3, col: 2 }).find(move => move.to.row === 2 && move.to.col === 2)!;
    expect(capture).toBeDefined();
    const next = applyMove(state, capture);
    expect(next.hands?.sente?.p).toBe(1);
    const html = renderToStaticMarkup(<BoardPlayerCard botLevelLabel="Normal" botModeActive={false} botStrengthDisplay="" canUseHand capturedPieces={next.captured} handCounts={next.hands?.sente} opponentCapturedPieces={[]} color="sente" humanColor="sente" isActive pieceSkin="hori" placement="bottom" supportsDrops thinking={false} timeControl="freestyle" variantKey="mini-shogi"/>);
    const hand = html.slice(html.indexOf('class="hand-tray"'), html.indexOf('class="captured-strip'));
    const captured = html.slice(html.indexOf('class="captured-strip'));
    expect(hand).toContain('/assets/shogi/hori/pawn.webp');
    expect(hand).toContain('data-owner="sente"');
    expect(hand).not.toContain('promoted-pawn.webp');
    expect(captured).toContain('/assets/shogi/hori/promoted-pawn.webp');
    expect(captured).toContain('data-owner="gote"');
  });
});
