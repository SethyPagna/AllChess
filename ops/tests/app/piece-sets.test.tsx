import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Box3, Mesh, Texture, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, test } from "vitest";
import { PieceIcon } from "@/components/board/piece-icon";
import { pieceSetModelPath, pieceSetOptions, pieceSetSkin, resolvePieceSet } from "@/components/board/piece-sets";
import { resolveAppearancePreset } from "@/components/board/appearance";

describe("coordinated piece collections", () => {
  test.each(["english-draughts", "international-draughts", "turkish-draughts"])("%s keeps a native set through board colour changes", key => {
    expect(pieceSetOptions(key).map(set => set.key)).toEqual(["standard", "rosette"]);
    expect(resolvePieceSet(key, "rosette")).toBe("rosette");
    for (const theme of ["default", "slate", "plum", "stone"] as const) {
      expect(pieceSetSkin(key, "rosette", resolveAppearancePreset(key, theme).pieceSkin)).toBe("rosette");
    }
    for (const side of ["white", "black"] as const) for (const code of ["p", "x"]) {
      const html = renderToStaticMarkup(<PieceIcon code={code} owner={side} pieceSkin="rosette" variantKey={key} promoted={code === "x"}/>);
      const file = `/assets/draughts/rosette/${side === "white" ? "light" : "dark"}-${code === "x" ? "king" : "man"}.webp`;
      expect(html).toContain(file);expect(readFileSync(`public${file}`).length).toBeGreaterThan(10000);
      expect(html).not.toContain('<circle');
    }
  });

  test("foreign and corrupt preferences cannot select an incompatible model", () => {
    for (const key of ["classic", "shogi", "ouk-chaktrang", "konane", "jungle"]) {
      expect(resolvePieceSet(key, "rosette")).toBe("standard");
      expect(pieceSetSkin(key, "rosette", "default")).toBe("default");
    }
    expect(resolvePieceSet("english-draughts", "../other.glb")).toBe("standard");
    expect(pieceSetModelPath("khmer", "rosette")).toBeUndefined();
  });

  test("rosette GLB has embedded PBR maps, physical carving and shared king meshes", async () => {
    const bytes=readFileSync(`public${pieceSetModelPath("draughts", "rosette")}`);
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
        expect(size.x).toBeCloseTo(.040,4);expect(size.z).toBeCloseTo(.040,4);
        expect(box.min.y).toBeCloseTo(0,5);expect(size.y).toBeCloseTo(root===man?.009:.0182,4);
      }
      expect(man.children).toHaveLength(1);expect(king.children).toHaveLength(2);
      const surface=(man.children[0] as Mesh).geometry;
      expect((king.children[0] as Mesh).geometry).toBe(surface);
      expect((king.children[1] as Mesh).geometry).toBe(surface);
      expect(surface.attributes.uv).toBeDefined();
      const position=surface.attributes.position;
      let lower=Infinity,upper=-Infinity;
      for(let i=0;i<position.count;i++) {const r=Math.hypot(position.getX(i),position.getZ(i));if(r>.007&&r<.013){lower=Math.min(lower,position.getY(i));upper=Math.max(upper,position.getY(i));}}
      expect(upper-lower).toBeGreaterThan(.001); // Top carving must have real relief.
    }
  });
});
