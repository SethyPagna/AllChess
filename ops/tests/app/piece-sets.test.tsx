import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Box3, Mesh, Texture, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, test } from "vitest";
import { PieceIcon } from "@/components/board/piece-icon";
import { pieceSetModelPath, pieceSetOptions, pieceSetSkin, readPieceSetPreference, resolvePieceSet } from "@/components/board/piece-sets";
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
  });

  test("storage restores each game independently and recovers a corrupt or inaccessible preference", () => {
    const stored = new Map([
      ["allchess-piece-set:english-draughts", "standard"],
      ["allchess-piece-set:international-draughts", "../corrupt"],
      ["allchess-piece-set:turkish-draughts", "club"],
      ["allchess-piece-set:classic", "club"]
    ]);
    const read = (key: string) => stored.get(key) ?? null;
    expect(readPieceSetPreference("english-draughts", read)).toBe("standard");
    expect(readPieceSetPreference("international-draughts", read)).toBe("rosette");
    expect(readPieceSetPreference("turkish-draughts", read)).toBe("club");
    expect(readPieceSetPreference("classic", read)).toBe("standard");
    const blocked = () => { throw new Error("Storage is unavailable"); };
    expect(readPieceSetPreference("english-draughts", blocked)).toBe("rosette");
    expect(readPieceSetPreference("shogi", blocked)).toBe("standard");
    expect(readPieceSetPreference("turkish-draughts", read)).toBe("club");
    expect(stored.get("allchess-piece-set:english-draughts")).toBe("standard");
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
