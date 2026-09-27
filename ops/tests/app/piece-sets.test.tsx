import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Box3, Mesh, Texture, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, test } from "vitest";
import { PieceIcon, resolvePieceSkin } from "@/components/board/piece-icon";
import { piece2DSkin, pieceSetModelPath, pieceSetOptions, pieceSetPreviewPieces, pieceSetSkin, readPiece2DStylePreference, readPieceSetPreference, resolvePiece2DStyle, resolvePieceSet } from "@/components/board/piece-sets";
import { applyMove, createInitialState, getLegalMoves } from "@/lib/variants";
import { collectionModelPath } from "@/components/board/board-3d-config";
import { resolveAppearancePreset } from "@/components/board/appearance";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { GameArtwork } from "@/components/games/game-artwork";

describe("coordinated piece collections", () => {
  test.each(["english-draughts", "international-draughts", "turkish-draughts"])("%s keeps a native set through board colour changes", key => {
    expect(pieceSetOptions(key).map(set => set.key)).toEqual(["standard", "rosette", "club"]);
    for (const set of pieceSetOptions(key)) {
      expect(resolvePieceSet(key, set.key)).toBe(set.key);
      for (const theme of ["default", "slate", "plum", "stone"] as const) {
        expect(pieceSetSkin(key, set.key, resolveAppearancePreset(key, theme).pieceSkin)).toBe(set.skin);
      }
    }
    for (const set of ["rosette", "club"] as const) for (const side of ["white", "black"] as const) for (const piece of [{ code: "p", promoted: false }, { code: "x", promoted: false }, { code: "p", promoted: true }]) {
      const html = renderToStaticMarkup(<PieceIcon {...piece} owner={side} pieceSkin={set} variantKey={key}/>);
      const file = `/assets/draughts/${set}/${side === "white" ? "light" : "dark"}-${piece.code === "x" || piece.promoted ? "king" : "man"}.webp`;
      expect(html).toContain(file);
      expect(html).toContain(`data-skin="${set}"`);
      expect(html).not.toContain('<circle');
    }
  });

  test.each(["english-draughts", "international-draughts", "turkish-draughts"])("%s discovery and unset preferences use Rosette without replacing an explicit Turned choice", key => {
    for (const value of [undefined, null, "", "../other.glb", "atelier"]) expect(resolvePieceSet(key, value)).toBe("rosette");
    expect(resolvePieceSet(key, "standard")).toBe("standard");
    expect(pieceSetSkin(key, "standard", "rosette")).toBe("checker");
    const artwork = renderToStaticMarkup(<GameArtwork variantKey={key}/>);
    expect(artwork).toContain('/assets/draughts/rosette/light-king.webp');
    expect(artwork).not.toContain('data-skin="checker"');
    const toolbar = renderToStaticMarkup(<BoardToolbar variantKey={key} appearancePreset="default" onAppearanceChange={() => {}} onFlip={() => {}} focusMode={false} onFocusChange={() => {}} canFocus={false} onPieceSetChange={() => {}}/>);
    expect(toolbar).toContain('aria-label="Choose Rosette pieces" aria-pressed="true"');
    expect(toolbar).toContain('aria-label="Choose Turned pieces" aria-pressed="false"');
    expect(toolbar).toContain('aria-label="Choose Club pieces" aria-pressed="false"');
    expect(toolbar).toContain('data-collection-count="3"');
    expect(pieceSetPreviewPieces(key)).toEqual([{ code: "p" }, { code: "x", promoted: true }]);
  });

  test("Cambodian collections keep Atelier as the native default and Courtyard through board colour changes", () => {
    const key = "ouk-chaktrang";
    expect(pieceSetOptions(key)).toEqual([
      { key: "standard", label: "Atelier", skin: "atelier", finishLabel: "Boxwood & rosewood" },
      { key: "courtyard", label: "Courtyard", skin: "courtyard", finishLabel: "Sandstone & charcoal" }
    ]);
    for (const value of [undefined, null, "", "rosette", "club", "../courtyard.glb"]) expect(resolvePieceSet(key, value)).toBe("standard");
    expect(resolvePieceSet(key, "courtyard")).toBe("courtyard");
    expect(pieceSetModelPath("khmer", "courtyard")).toBe("/assets/khmer/courtyard.glb");
    expect(pieceSetModelPath("khmer", "standard") ?? collectionModelPath("khmer")).toBe("/assets/khmer/atelier.glb");
    for (const theme of ["default", "slate", "plum", "contrast", "tablet"] as const) {
      const fallback = resolveAppearancePreset(key, theme).pieceSkin;
      expect(pieceSetSkin(key, "standard", fallback)).toBe("atelier");
      expect(pieceSetSkin(key, "courtyard", fallback)).toBe("courtyard");
    }
    const artwork = renderToStaticMarkup(<GameArtwork variantKey={key}/>);
    expect(artwork).toContain('/assets/khmer/atelier/light-king.webp');
    expect(artwork).not.toContain('/assets/khmer/courtyard/');
  });

  test("Cambodian picker previews each collection with a native king and opposing horse", () => {
    expect(pieceSetPreviewPieces("ouk-chaktrang")).toEqual([{ code: "k" }, { code: "n" }]);
    const renderToolbar = (pieceSet?: "standard" | "courtyard") => renderToStaticMarkup(<BoardToolbar variantKey="ouk-chaktrang" pieceSet={pieceSet} appearancePreset="default" onAppearanceChange={() => {}} onFlip={() => {}} focusMode={false} onFocusChange={() => {}} canFocus={false} onPieceSetChange={() => {}}/>);
    const toolbar = renderToolbar();
    expect(toolbar).toContain('data-collection-count="2"');
    expect(toolbar).toContain('aria-label="Choose Atelier pieces" aria-pressed="true"');
    expect(toolbar).toContain('aria-label="Choose Courtyard pieces" aria-pressed="false"');
    for (const skin of ["atelier", "courtyard"]) {
      expect(toolbar).toContain(`/assets/khmer/${skin}/light-king.webp`);
      expect(toolbar).toContain(`/assets/khmer/${skin}/dark-horse.webp`);
    }
    expect(toolbar).not.toContain('data-code="x"');
    expect(toolbar).not.toContain('data-promoted="true"');
    expect(renderToolbar("courtyard")).toContain('aria-label="Choose Courtyard pieces" aria-pressed="true"');
  });

  test.each(["atelier", "courtyard"] as const)("%s maps Cambodian roles and retains the promotion mark on a Neang", skin => {
    for (const owner of ["white", "black"] as const) {
      const side = owner === "white" ? "light" : "dark";
      for (const [code, name] of Object.entries({ k: "king", m: "queen", s: "bishop", n: "horse", r: "rook", p: "pawn" })) {
        const html = renderToStaticMarkup(<PieceIcon variantKey="ouk-chaktrang" pieceSkin={skin} code={code} owner={owner}/>);
        expect(html).toContain(`/assets/khmer/${skin}/${side}-${name}.webp`);
        expect(html).toContain(`data-skin="${skin}"`);
        expect(html).not.toContain('data-promoted="true"');
      }
      const promoted = renderToStaticMarkup(<PieceIcon variantKey="ouk-chaktrang" pieceSkin={skin} code="m" owner={owner} promoted/>);
      expect(promoted).toContain(`/assets/khmer/${skin}/${side}-queen.webp`);
      expect(promoted).toContain('data-promoted="true"');
      expect(promoted).toContain('Promoted fish');
      expect(promoted).toContain('<circle');
      expect(promoted).not.toContain(`${side}-king.webp`);
    }
  });

  test.each([["tablet", "letters"], ["contrast", "clear"], ["default", "collection"], ["invalid", "collection"]] as const)("migrates the old %s look once, independently of later board colours", (legacy, expected) => {
    const key = "allchess-piece-2d-style:ouk-chaktrang";
    const stored = new Map([["allchess-appearance-set:ouk-chaktrang", legacy as string], ["allchess-piece-set:ouk-chaktrang", "courtyard"]]);
    const read = (key: string) => stored.get(key) ?? null;
    const write = (key: string, value: string) => { stored.set(key, value); };
    expect(readPiece2DStylePreference("ouk-chaktrang", read, write)).toBe(expected);
    expect(stored.get(key)).toBe(expected);
    stored.set("allchess-appearance-set:ouk-chaktrang", "slate");
    expect(readPiece2DStylePreference("ouk-chaktrang", read, write)).toBe(expected);
    expect(readPieceSetPreference("ouk-chaktrang", read)).toBe("courtyard");
    stored.set(key, "collection");
    stored.set("allchess-appearance-set:ouk-chaktrang", "tablet");
    expect(readPiece2DStylePreference("ouk-chaktrang", read, write)).toBe("collection");
  });

  test("2D style preference survives unrelated storage failures and rejects corrupt values", () => {
    const blocked = () => { throw new Error("Storage is unavailable"); };
    expect(readPiece2DStylePreference("ouk-chaktrang", blocked, blocked)).toBe("collection");
    for (const value of ["letters", "clear", "collection"] as const) {
      const read = (key: string) => key.startsWith("allchess-piece-2d-style:") ? value : blocked();
      expect(readPiece2DStylePreference("ouk-chaktrang", read, blocked)).toBe(value);
    }
    const legacyOnly = (key: string) => key.startsWith("allchess-appearance-set:") ? "tablet" : null;
    expect(readPiece2DStylePreference("ouk-chaktrang", legacyOnly, blocked)).toBe("letters");
    for (const value of ["", "tablet", "courtyard", "../invalid"]) expect(resolvePiece2DStyle("ouk-chaktrang", value, "tablet")).toBe("collection");
    // A blocked legacy read must not overwrite a preference that can recover later.
    const writes: string[] = [];
    expect(readPiece2DStylePreference("ouk-chaktrang", key => key.startsWith("allchess-piece-2d-style:") ? null : blocked(), key => writes.push(key))).toBe("collection");
    expect(writes).toEqual([]);
    for (const game of ["english-draughts", "xiangqi", "classic", "makruk"]) {
      expect(readPiece2DStylePreference(game, blocked, blocked)).toBe("collection");
      expect(resolvePiece2DStyle(game, "letters", "tablet")).toBe("collection");
      expect(piece2DSkin(game, "standard", "default", "letters")).toBe(pieceSetSkin(game, "standard", "default"));
    }
  });

  test("Cambodian 2D readability is independent of the native collection and board colour", () => {
    for (const set of ["standard", "courtyard"] as const) for (const theme of ["default", "contrast", "tablet", "slate", "plum"] as const) {
      const fallback = resolveAppearancePreset("ouk-chaktrang", theme).pieceSkin;
      expect(piece2DSkin("ouk-chaktrang", set, fallback, "letters")).toBe("tile");
      expect(piece2DSkin("ouk-chaktrang", set, fallback, "clear")).toBe("khmer");
      expect(piece2DSkin("ouk-chaktrang", set, fallback, "collection")).toBe(set === "courtyard" ? "courtyard" : "atelier");
    }
    const toolbar = (variantKey: string, is3D = false) => renderToStaticMarkup(<BoardToolbar variantKey={variantKey} pieceSet="courtyard" piece2DStyle="letters" onPiece2DStyleChange={() => {}} appearancePreset="slate" onAppearanceChange={() => {}} onFlip={() => {}} focusMode={false} onFocusChange={() => {}} canFocus={false} onPieceSetChange={() => {}} is3D={is3D}/>);
    const html = toolbar("ouk-chaktrang");
    expect(html).toContain('aria-label="Use Letters pieces" aria-pressed="true"');
    expect(html).toContain('aria-label="Use Artwork pieces" aria-pressed="false"');
    expect(html).toContain('aria-label="Use Clear pieces" aria-pressed="false"');
    expect(html).toContain('aria-label="Choose Courtyard pieces" aria-pressed="true"');
    expect(html).toContain('/assets/khmer/courtyard/light-king.webp');
    expect(toolbar("ouk-chaktrang", true)).not.toContain('aria-label="2D piece style"');
    expect(toolbar("english-draughts")).not.toContain('aria-label="2D piece style"');
  });

  test("native Trey promotion stays a marked Neang in Artwork, Clear and Letters", () => {
    const state = createInitialState("ouk-chaktrang");
    const pawn = state.board[5][4].piece!;
    state.board[5][4].piece = null;
    state.board[2][4].piece = null;
    state.board[3][4].piece = pawn;
    const move = getLegalMoves(state, { row: 3, col: 4 }).find(move => move.to.row === 2 && move.to.col === 4)!;
    expect(move).toBeDefined();
    const promoted = applyMove(state, move).board[2][4].piece!;
    expect(promoted.code).toBe("m");
    expect(promoted.promoted).toBe(true);
    for (const style of ["collection", "clear", "letters"] as const) for (const owner of ["white", "black"] as const) {
      const skin = piece2DSkin("ouk-chaktrang", "courtyard", "default", style);
      const html = renderToStaticMarkup(<PieceIcon variantKey="ouk-chaktrang" pieceSkin={skin} code={promoted.code} promoted={promoted.promoted} owner={owner}/>);
      expect(html).toContain('data-code="m"');
      expect(html).toContain(`data-owner="${owner}"`);
      expect(html).toContain('data-promoted="true"');
      expect(html).toContain('Promoted fish · Neang · Queen');
      if (style === "letters") expect(html).toContain("ន");
      else expect(html).toContain("<circle");
    }
  });

  test("storage restores each game independently and recovers a corrupt or inaccessible preference", () => {
    const stored = new Map([
      ["allchess-piece-set:english-draughts", "standard"],
      ["allchess-piece-set:international-draughts", "../corrupt"],
      ["allchess-piece-set:turkish-draughts", "club"],
      ["allchess-piece-set:classic", "club"],
      ["allchess-piece-set:ouk-chaktrang", "courtyard"]
    ]);
    const read = (key: string) => stored.get(key) ?? null;
    expect(readPieceSetPreference("english-draughts", read)).toBe("standard");
    expect(readPieceSetPreference("international-draughts", read)).toBe("rosette");
    expect(readPieceSetPreference("turkish-draughts", read)).toBe("club");
    expect(readPieceSetPreference("classic", read)).toBe("standard");
    expect(readPieceSetPreference("ouk-chaktrang", read)).toBe("courtyard");
    const blocked = () => { throw new Error("Storage is unavailable"); };
    expect(readPieceSetPreference("english-draughts", blocked)).toBe("rosette");
    expect(readPieceSetPreference("shogi", blocked)).toBe("standard");
    expect(readPieceSetPreference("ouk-chaktrang", blocked)).toBe("standard");
    expect(readPieceSetPreference("turkish-draughts", read)).toBe("club");
    expect(stored.get("allchess-piece-set:english-draughts")).toBe("standard");
    stored.set("allchess-piece-set:ouk-chaktrang", "rosette");
    expect(readPieceSetPreference("ouk-chaktrang", read)).toBe("standard");
    expect(readPieceSetPreference("turkish-draughts", read)).toBe("club");
  });

  test("foreign and corrupt preferences cannot select an incompatible model", () => {
    for (const set of ["rosette", "club"] as const) for (const key of ["classic", "shogi", "ouk-chaktrang", "konane", "jungle"]) {
      expect(resolvePieceSet(key, set)).toBe("standard");
      expect(pieceSetSkin(key, set, "default")).toBe("default");
    }
    expect(pieceSetModelPath("khmer", "rosette")).toBeUndefined();
    expect(pieceSetModelPath("classic", "club")).toBeUndefined();
    expect(pieceSetModelPath("draughts", "club")).toBe("/assets/draughts/club.glb");
    expect(pieceSetModelPath("draughts", "standard")).toBeUndefined();
    for (const key of ["classic", "shogi", "makruk", "english-draughts", "international-draughts", "turkish-draughts"]) {
      expect(resolvePieceSet(key, "courtyard")).toBe(key.includes("draughts") ? "rosette" : "standard");
      expect(pieceSetSkin(key, "courtyard", "default")).toBe("default");
      expect(resolvePieceSkin(key, "courtyard")).not.toBe("courtyard");
    }
    for (const family of ["classic", "makruk", "draughts", "shogi"] as const) expect(pieceSetModelPath(family, "courtyard")).toBeUndefined();
  });

  test("photographic draughts sprites are available locally", () => {
    for (const set of ["rosette", "club"]) for (const side of ["light", "dark"]) for (const piece of ["man", "king"]) {
      expect(readFileSync(`public/assets/draughts/${set}/${side}-${piece}.webp`).length).toBeGreaterThan(10000);
    }
  });

  test.each([
    { set: "rosette" as const, diameter: .040, height: .009, kingHeight: .0182 },
    { set: "club" as const, diameter: .042, height: .008, kingHeight: .0162 }
  ])("$set GLB has embedded PBR maps, physical relief and shared king meshes", async ({ set, diameter, height, kingHeight }) => {
    const bytes=readFileSync(`public${pieceSetModelPath("draughts", set)}`);
    expect(bytes.length).toBeLessThan(7_000_000);
    const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString("utf8"));
    expect(json.images.length).toBeGreaterThanOrEqual(4);
    expect(json.images.every((image:{uri?:string})=>!image.uri)).toBe(true);
    expect(json.buffers.every((buffer:{uri?:string})=>!buffer.uri)).toBe(true);
    for (const material of json.materials) {
      expect(material.normalTexture).toBeDefined();
      expect(material.pbrMetallicRoughness.baseColorTexture).toBeDefined();
      expect(material.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
    }
    const loader=new GLTFLoader().register(()=>({name:"NODE_TEXTURE_CHECK",loadTexture:()=>Promise.resolve(new Texture())}));
    const model=await loader.parseAsync(Uint8Array.from(bytes).buffer,"");
    for(const side of ["light","dark"]) {
      const man=model.scene.getObjectByName(`${side}_man`)!,king=model.scene.getObjectByName(`${side}_king`)!;
      expect(man).toBeDefined();expect(king).toBeDefined();
      for(const root of [man,king]) {
        root.position.set(0,0,0);root.updateWorldMatrix(true,true);
        const box=new Box3().setFromObject(root,true),size=box.getSize(new Vector3());
        expect(size.x).toBeCloseTo(diameter,4);expect(size.z).toBeCloseTo(diameter,4);
        expect(box.min.y).toBeCloseTo(0,5);expect(size.y).toBeCloseTo(root===man?height:kingHeight,4);
      }
      expect(man.children).toHaveLength(1);expect(king.children).toHaveLength(2);
      const surface=(man.children[0] as Mesh).geometry;
      expect((king.children[0] as Mesh).geometry).toBe(surface);
      expect((king.children[1] as Mesh).geometry).toBe(surface);
      expect(surface.attributes.uv).toBeDefined();
      const position=surface.attributes.position;
      if (set === "rosette") {
        let lower=Infinity,upper=-Infinity;
        for(let i=0;i<position.count;i++) {const r=Math.hypot(position.getX(i),position.getZ(i));if(r>.007&&r<.013){lower=Math.min(lower,position.getY(i));upper=Math.max(upper,position.getY(i));}}
        expect(upper-lower).toBeGreaterThan(.001); // Petal carving has physical depth.
      } else {
        let centre=-Infinity,rim=-Infinity;
        for(let i=0;i<position.count;i++) {const r=Math.hypot(position.getX(i),position.getZ(i));if(r<.002)centre=Math.max(centre,position.getY(i));if(r>.017)rim=Math.max(rim,position.getY(i));}
        expect(rim-centre).toBeGreaterThan(.001); // Club's dish must sit below its rim.
      }
    }
  });
});
