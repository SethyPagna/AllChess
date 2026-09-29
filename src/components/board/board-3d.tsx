"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { BoardCell, GameState, PlayerColor, Square } from "@/lib/variants";
import { sameSquare, serializeSquare, getVariant } from "@/lib/variants";
import type { BoardThemePreference } from "./appearance";
import { board3DPalettes, collectionModelPath, collectionPieces, pieceModelName, shogiPromotedCodes, board3DLayout, type PieceCollection, type PieceFinish } from "./board-3d-config";
import { fitTabletopBounds, tabletopCoordinateFrame, tabletopCoordinateHeight, tabletopFrame } from "./tabletop-camera";
import { tabletopGesture } from "./tabletop-gesture";
import { pieceSetModelPath, type PieceSetId } from "./piece-sets";

import { createKonaneCellGeometry } from "./konane-board";
import { createJungleTerrainKit, jungleWaterTop } from "./jungle-board";
import { intersectionBoardLines } from "./intersection-board";
import { createTabletopScene } from "./tabletop-scene";
import { shogiHandSlots, shogiStandTop } from "./shogi-stands";

type Props = {
  collection: PieceCollection; variantKey: string; orientedRows: BoardCell[][]; legalTargets: Set<string>;
  selected: Square | null; lastMove?: { from: Square; to: Square }; onChoose: (square: Square) => void;
  boardTheme: BoardThemePreference; finish: PieceFinish;
  pieceSet?: PieceSetId;
  hands?: GameState["hands"]; selectedHand?: { owner: PlayerColor; code: string } | null;
  onChooseHand?: (owner: PlayerColor, code: string) => void;
  onFallback: () => void;
};

export default function Board3D(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const update = useRef<(() => void) | null>(null);
  const resetCamera = useRef<(() => void) | null>(null);
  const zoomCamera = useRef<((factor:number) => void) | null>(null);
  const [status, setStatus] = useState("Loading 3D pieces…");
  const [failed, setFailed] = useState(false);
  useEffect(() => { latest.current = props; update.current?.(); }, [props]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false, contextLost = false;
    let renderer: THREE.WebGLRenderer;
    let rendererDisposed = false;
    const disposeRenderer = () => {
      if (rendererDisposed) return;
      rendererDisposed = true;
      renderer.dispose();
    };
    const fail = (message: string) => { if (!disposed) { setStatus(message); setFailed(true); } };
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { queueMicrotask(() => fail("3D is unavailable on this device.")); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping;
    element.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const { rows, cols } = getVariant(props.variantKey).board;
    const layout = board3DLayout(props.collection, rows, cols);
    const japanese = props.collection === "shogi";
    const papamu = props.collection === "konane";
    const jungle = props.collection === "jungle";
    const jungleTerrain = jungle ? createJungleTerrainKit(layout.pitchX) : null;
    const historical = props.collection === "shatranj" || props.collection === "chaturanga";
    const thai = props.collection === "makruk";
    const draughts = props.collection === "draughts";
    const texturedSet = props.collection === "classic" || props.collection === "khmer" || !!pieceSetModelPath(props.collection, props.pieceSet ?? "standard");
    const plainGrid = japanese || thai || historical || props.variantKey === "turkish-draughts";
    const checkered = props.collection === "classic" || (draughts && !plainGrid);
    const intersection = props.collection === "xiangqi" || props.collection === "janggi";
    const lettered = japanese || intersection;
    let frame=tabletopFrame(props.collection,rows,cols,element.clientWidth||640,window.innerHeight);
    let customized=false, adjustingCamera=false, automaticOrbit=true;
    const camera = new THREE.PerspectiveCamera(frame.fieldOfView, frame.aspect, .01, 10);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(frame.target); controls.enablePan = true; controls.screenSpacePanning=false;
    controls.cursor.copy(frame.target); controls.maxTargetRadius=Math.max(layout.width,layout.depth);
    controls.minDistance = frame.distance*.52; controls.maxDistance = frame.maxDistance;
    controls.minPolarAngle = .45; controls.maxPolarAngle = Math.PI / 2.35;
    function applyCamera() {
      adjustingCamera=true; customized=false; automaticOrbit=true;
      camera.position.copy(frame.position); controls.target.copy(frame.target); controls.update();
      adjustingCamera=false;
    }
    resetCamera.current = applyCamera; applyCamera();
    zoomCamera.current=factor=>{
      automaticOrbit=false;
      const offset=camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));
      camera.position.copy(controls.target).add(offset);controls.update();
    };
    const carvedShogi = japanese && props.pieceSet === "hori";
    const celadonXiangqi = props.collection === "xiangqi" && props.pieceSet === "celadon";
    const shoreKonane = papamu && props.pieceSet === "shore";
    const boardSurfacePath = shoreKonane ? "/assets/konane/shore/board-colour.webp" : carvedShogi ? "/assets/shogi/hori/board-colour.webp" : celadonXiangqi ? "/assets/xiangqi/celadon/board-colour.webp" : undefined;
    const tabletop = createTabletopScene(scene, renderer, layout.width, layout.depth, japanese, props.collection, () => {
      lastPosition = ""; redraw();
    }, boardSurfacePath, shoreKonane);
    tabletop.setCompactHands(frame.compactHands);
    const meshes = new THREE.Group(); scene.add(meshes);
    const grid = new THREE.Group(); scene.add(grid);
    const gridGeometries: THREE.BufferGeometry[] = [];
    const gridMaterial = new THREE.MeshBasicMaterial({ color: 0x50381d });
    let japaneseGridMaterial: THREE.ShaderMaterial | undefined;
    if (plainGrid) {
      if (japanese) {
        // Physical ink with filtered pixel coverage: distant .6 mm bars must
        // not disappear between samples. Derivatives follow orbit and zoom
        // without CPU projection work or lifting the grid above the pieces.
        japaneseGridMaterial = new THREE.ShaderMaterial({
          uniforms: {
            ink: { value: gridMaterial.color.clone() },
            cellPitch: { value: new THREE.Vector2(layout.pitchX, layout.pitchZ) },
            cellCount: { value: new THREE.Vector2(cols, rows) },
            pixelRatio: { value: renderer.getPixelRatio() },
          },
          vertexShader: `
            uniform vec2 cellPitch;
            uniform vec2 cellCount;
            varying vec2 gridPosition;
            void main() {
              gridPosition = position.xy / cellPitch + cellCount * 0.5;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform vec3 ink;
            uniform vec2 cellPitch;
            uniform float pixelRatio;
            varying vec2 gridPosition;
            void main() {
              vec2 dx = dFdx(gridPosition), dy = dFdy(gridPosition);
              vec2 unitsPerPixel = max(sqrt(dx * dx + dy * dy), vec2(0.000001));
              vec2 distanceToLine = abs(fract(gridPosition + 0.5) - 0.5) / unitsPerPixel;
              vec2 halfWidth = max(vec2(0.0003) / cellPitch / unitsPerPixel, vec2(0.35 * pixelRatio));
              vec2 coverage = 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, distanceToLine);
              float alpha = 1.0 - (1.0 - coverage.x) * (1.0 - coverage.y);
              if (alpha < 0.001) discard;
              gl_FragColor = vec4(ink, alpha);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }
          `,
          transparent: true, depthTest: true, depthWrite: false, premultipliedAlpha: false,
        });
        // The small margin retains both halves of the outer ink strokes.
        const geometry = new THREE.PlaneGeometry(layout.width + .006, layout.depth + .006);
        gridGeometries.push(geometry);
        const ink = new THREE.Mesh(geometry, japaneseGridMaterial);
        ink.rotation.x = -Math.PI / 2; ink.position.y = .00235; grid.add(ink);
      } else {
        const vertical = new THREE.BoxGeometry(.0006, .0005, layout.depth), horizontal = new THREE.BoxGeometry(layout.width, .0005, .0006);
        gridGeometries.push(vertical, horizontal);
        for (let c = 0; c <= cols; c++) { const line = new THREE.Mesh(vertical, gridMaterial); line.position.set((c-cols/2)*layout.pitchX, .0021, 0); grid.add(line); }
        for (let r = 0; r <= rows; r++) { const line = new THREE.Mesh(horizontal, gridMaterial); line.position.set(0, .0021, (r-rows/2)*layout.pitchZ); grid.add(line); }
      }
      if (rows === 9) {
        const starGeometry = new THREE.CircleGeometry(.0017, 16); gridGeometries.push(starGeometry);
        for (const x of [-1.5,1.5]) for (const z of [-1.5,1.5]) { const star = new THREE.Mesh(starGeometry, gridMaterial); star.rotation.x = -Math.PI/2; star.position.set(x*layout.pitchX,.0025,z*layout.pitchZ); grid.add(star); }
      }
    }
    if (intersection) {
      for (const { from, to } of intersectionBoardLines(props.collection as "xiangqi" | "janggi")) {
        const x1 = (from[1]-(cols-1)/2)*layout.pitchX, z1 = (from[0]-(rows-1)/2)*layout.pitchZ;
        const x2 = (to[1]-(cols-1)/2)*layout.pitchX, z2 = (to[0]-(rows-1)/2)*layout.pitchZ;
        const geometry = new THREE.BoxGeometry(Math.hypot(x2-x1,z2-z1), .0004, .00065); gridGeometries.push(geometry);
        const line = new THREE.Mesh(geometry, gridMaterial); line.position.set((x1+x2)/2,.0023,(z1+z2)/2); line.rotation.y = -Math.atan2(z2-z1,x2-x1); grid.add(line);
      }
    }
    const surfaceGeometry = new THREE.BoxGeometry(layout.width, .004, layout.depth);
    const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    const tileGeometry = papamu ? createKonaneCellGeometry(layout.pitchX) : new THREE.BoxGeometry(layout.pitchX - .0005, .004, layout.pitchZ - .0005);
    if (shoreKonane) {
      const vertices = tileGeometry.getAttribute("position"), cavity = new Float32Array(vertices.count * 3);
      for (let i = 0; i < vertices.count; i++) {
        const shade = 1 - .28 * THREE.MathUtils.clamp((.002 - vertices.getY(i)) / .008, 0, 1);
        cavity.fill(shade, i * 3, i * 3 + 3);
      }
      tileGeometry.setAttribute("color", new THREE.BufferAttribute(cavity, 3));
    }
    const plainTiles = (plainGrid || papamu) ? Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => {
      const geometry = tileGeometry.clone(), uv = geometry.getAttribute("uv"), positions = geometry.getAttribute("position");
      // Keep the surface continuous across separately selectable cells.
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (positions.getX(i)+(c+.5)*layout.pitchX)/layout.width, 1-(positions.getZ(i)+(r+.5)*layout.pitchZ)/layout.depth);
      return geometry;
    })) : null;
    const dotGeometry = new THREE.CircleGeometry(.0065, 24);
    const ringGeometry = new THREE.RingGeometry(intersection ? .0235 : papamu ? .022 : .018, intersection ? .0255 : papamu ? .024 : .021, 48);
    const riverGeometry = new THREE.PlaneGeometry(.32, .032);
    const promotionGeometry = new THREE.RingGeometry(.0155, .017, 32);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x316a50, side: THREE.DoubleSide });
    const waterMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xf0d597, side: THREE.DoubleSide });
    const promotionMaterial = new THREE.MeshBasicMaterial({ color: 0xc9a246, side: THREE.DoubleSide });

    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    let model: THREE.Group | null = null;
    let modelReady = false;
    const disposableMaterials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const retiredResources: (THREE.Material | THREE.Texture)[] = [];
    const releaseRetiredResources = () => retiredResources.splice(0).forEach(resource => resource.dispose());
    const labelGeometry = new THREE.PlaneGeometry(1, 1);
    const handHitGeometry = new THREE.BoxGeometry(.047, .022, .048);
    let lastPosition = "";
    let sceneRevision = 0;
    const render = () => {
      if (disposed || contextLost || !modelReady) return;
      camera.updateMatrixWorld();
      for (const mesh of meshes.children) if (mesh.userData.coordinate) {
        const coordinate=tabletopCoordinateFrame(mesh.userData.coordinateAnchor,camera,element.clientWidth||640,mesh.userData.glyphHeight);
        mesh.position.copy(coordinate.position);
        mesh.quaternion.copy(camera.quaternion);
        mesh.scale.set(coordinate.height*mesh.userData.glyphWidth,coordinate.height*mesh.userData.glyphHeight,1);
      }
      renderer.render(scene, camera);
      releaseRetiredResources();
    };
    function label(text: string, x: number, z: number, hand = false) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      const font="600 96px sans-serif"; ctx.font=font;
      const metrics=ctx.measureText(text),reference=ctx.measureText(japanese?"田":"0");
      const capHeight=reference.actualBoundingBoxAscent+reference.actualBoundingBoxDescent;
      canvas.width=Math.ceil(metrics.actualBoundingBoxLeft+metrics.actualBoundingBoxRight)+6;
      canvas.height=Math.ceil(metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent)+6;
      ctx.font=font;ctx.fillStyle=shoreKonane?"#302c28":japanese?"#302011":"#f2e0bb";
      if(!japanese&&!shoreKonane){ctx.strokeStyle="#2b2017";ctx.lineWidth=5;ctx.lineJoin="round";ctx.strokeText(text,3+metrics.actualBoundingBoxLeft,3+metrics.actualBoundingBoxAscent);}
      ctx.fillText(text,3+metrics.actualBoundingBoxLeft,3+metrics.actualBoundingBoxAscent);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); textures.push(texture);
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }); disposableMaterials.push(material);
      const plane = new THREE.Mesh(labelGeometry, material); plane.rotation.x = -Math.PI/2; plane.position.set(x, .006, z);
      plane.userData.coordinate=!hand;plane.userData.glyphWidth=canvas.width/capHeight;plane.userData.glyphHeight=canvas.height/capHeight;
      if(!hand)plane.userData.coordinateAnchor=plane.position.clone();
      const height=hand ? .009 : tabletopCoordinateHeight(plane.position,camera,element!.clientWidth||640);
      plane.scale.set(height*plane.userData.glyphWidth,height*plane.userData.glyphHeight,1);meshes.add(plane);
    }
    function redraw() {
      if (disposed || contextLost) return;
      const current = latest.current;
      const position = JSON.stringify([Boolean(model), frame.compactHands, current.boardTheme, current.finish, current.selected, current.lastMove, current.hands, current.selectedHand, [...current.legalTargets], current.orientedRows.map(row => row.map(cell => [cell.square, cell.terrain, cell.piece?.owner, cell.piece?.code, cell.piece?.promoted]))]);
      if (position === lastPosition) return;
      lastPosition = position;
      sceneRevision++;
      meshes.clear(); retiredResources.push(...disposableMaterials.splice(0), ...textures.splice(0));
      const finishMaterials = new Map<string, THREE.Material>();
      const palette = board3DPalettes[current.boardTheme];
      const boardSurface = (carvedShogi || celadonXiangqi || shoreKonane) && current.boardTheme === "wood" ? tabletop.boardSurface : null;
      const surfaceMap = boardSurface ?? (shoreKonane ? null : tabletop.grain);
      // Xiangqi keeps its native rosewood case independent of the playing surface.
      if (japanese || shoreKonane) tabletop.setBoardSurface(Boolean(boardSurface));
      function addPiece(piece: THREE.Object3D, light: boolean, target: Record<string, unknown>) {
        piece.traverse(child => {
          Object.assign(child.userData, target);
          if (!(child instanceof THREE.Mesh)) return;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          const paintedInk = lettered && materials.every(material => /ink/i.test(material.name));
          child.castShadow = !paintedInk; child.receiveShadow = !paintedInk;
          if (current.finish === "original" && (texturedSet || !(japanese || current.collection === "xiangqi" || draughts))) return;
          const finish = (original: THREE.Material) => {
            if (!(original instanceof THREE.MeshStandardMaterial) || /brass|inlay|felt|ink/i.test(original.name)) return original;
            const id = `${original.uuid}:${light}`;
            let changed = finishMaterials.get(id);
            if (!changed) {
              const copy = original.clone();
              if (!texturedSet && (japanese || current.collection === "xiangqi" || draughts)) { copy.map = tabletop.grain; copy.bumpMap = tabletop.grain; copy.bumpScale = .000035; }
              if (current.finish !== "original") {
                if (texturedSet) copy.map = null;
                if (current.collection === "khmer" || ((draughts || japanese || celadonXiangqi) && texturedSet)) {
                  // Keep sculpted horse relief; alternate finishes replace
                  // the original timber or ceramic surface microtexture.
                  if (!/Ses relief/.test(original.name)) copy.normalMap = null;
                  copy.roughnessMap = null;
                }
                copy.color.set(current.finish === "porcelain" ? (light || lettered) ? 0xfff7e6 : 0x24313b : (light || lettered) ? 0xe2e9e9 : 0x385773);
                copy.roughness = current.finish === "porcelain" ? .2 : .65; copy.metalness = 0;
              }
              changed = copy; finishMaterials.set(id, copy); disposableMaterials.push(copy);
            }
            return changed;
          };
          child.material = Array.isArray(child.material) ? child.material.map(finish) : finish(child.material);
        }); meshes.add(piece);
      }
      if (intersection) {
        const surfaceMaterial = new THREE.MeshPhysicalMaterial({
          color: boardSurface ? 0xffffff : current.boardTheme === "wood" ? 0xd5b987 : palette[0],
          map: boardSurface ?? tabletop.grain, bumpMap: boardSurface ?? tabletop.grain,
          bumpScale: boardSurface ? .000012 : .000025, roughness: boardSurface ? .58 : .46, clearcoat: boardSurface ? .12 : .2
        }); disposableMaterials.push(surfaceMaterial);
        const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial); surface.receiveShadow = true; meshes.add(surface);
        if (current.collection === "xiangqi") {
          const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 96;
          const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#50381d"; ctx.font = "500 64px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("楚 河",128,48); ctx.fillText("漢 界",384,48);
          const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); textures.push(texture);
          const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }); disposableMaterials.push(material);
          const river = new THREE.Mesh(riverGeometry, material); river.rotation.x = -Math.PI/2; river.position.y = .0026; if (current.orientedRows[0][0].square.row !== 0) river.rotation.z = Math.PI; meshes.add(river);
        }
      }
      current.orientedRows.forEach((row, r) => row.forEach((cell, c) => {
        const water = jungle && cell.terrain === "river";
        const surfaceY = water ? jungleWaterTop : .002;
        const isSelected = current.selected && sameSquare(current.selected, cell.square);
        const legal = current.legalTargets.has(serializeSquare(cell.square));
        const last = current.lastMove && (sameSquare(current.lastMove.from, cell.square) || sameSquare(current.lastMove.to, cell.square));
        const color = new THREE.Color(boardSurface ? 0xffffff : shoreKonane && current.boardTheme === "wood" ? 0x82796d : (japanese || (draughts && plainGrid)) && current.boardTheme === "wood" ? 0xd9b77d : palette[checkered ? (cell.square.row + cell.square.col) % 2 : 0]);
        if (water) color.set(0x236e78);
        const objective = current.variantKey === "king-of-the-hill" && [3,4].includes(cell.square.row) && [3,4].includes(cell.square.col) || current.variantKey === "racing-kings" && cell.square.row === 0;
        if (objective) color.lerp(new THREE.Color(0xd6a648), .4);
        if (last) color.lerp(new THREE.Color(0xd9bb45), .35);
        if (isSelected) color.set(0xd5b64b);
        const material = intersection ? hitMaterial : new THREE.MeshPhysicalMaterial({ color, vertexColors: shoreKonane, map: water ? null : surfaceMap, bumpMap: water ? null : surfaceMap, bumpScale: shoreKonane ? .000035 : boardSurface ? .000012 : .000025, roughness: water ? .16 : shoreKonane ? .88 : boardSurface ? .58 : papamu ? .55 : .34, clearcoat: water ? .9 : shoreKonane ? 0 : boardSurface || papamu ? .12 : .4, clearcoatRoughness: .28 }); if (!intersection) disposableMaterials.push(material);
        const tile = new THREE.Mesh(jungleTerrain ? water ? jungleTerrain.water : jungleTerrain.land : plainTiles?.[r][c] ?? tileGeometry, material); tile.position.set((c-(cols-1)/2)*layout.pitchX, 0, (r-(rows-1)/2)*layout.pitchZ); tile.userData.square = cell.square; tile.receiveShadow = !intersection; meshes.add(tile);
        if (jungleTerrain) {const marks=jungleTerrain.decorate(cell);marks.position.copy(tile.position);meshes.add(marks);}
        if (intersection && (isSelected || last)) {
          const material = new THREE.MeshBasicMaterial({ color: isSelected ? 0x9b5e00 : 0xb08a36, side: THREE.DoubleSide }); disposableMaterials.push(material);
          const halo = new THREE.Mesh(ringGeometry, material); halo.rotation.x = -Math.PI/2; halo.position.set(tile.position.x,.0027,tile.position.z); meshes.add(halo);
        }
        if (legal || (cell.piece?.promoted && !japanese && !draughts)) {
          const marker = new THREE.Mesh(legal ? (cell.piece || papamu) ? ringGeometry : dotGeometry : promotionGeometry, legal ? water ? waterMarkerMaterial : markerMaterial : promotionMaterial);
          marker.rotation.x = -Math.PI/2; marker.position.set(tile.position.x, surfaceY+.001, tile.position.z); marker.userData.square = cell.square; meshes.add(marker);
        }
        if (cell.piece && model) {
          const light = cell.piece.owner === getVariant(current.variantKey).players[0];
          const name = pieceModelName(current.collection, cell.piece.code, light, cell.piece.promoted);
          const source = model.getObjectByName(name);
          if (source) {
            const piece = source.clone(true); piece.position.set(tile.position.x, papamu ? -.006 : surfaceY, tile.position.z);
            if (papamu) piece.rotation.y = (cell.square.row*17+cell.square.col*7)*.37;
            if (current.collection === "classic" || lettered || thai || historical || jungle) piece.rotation.y = ((light !== (current.orientedRows[0][0].square.row === 0)) ? Math.PI : 0) + ((current.collection === "classic" || thai) && cell.piece.code === "n" ? (thai ? -Math.PI/4 : Math.PI/4) : 0);
            addPiece(piece, light, { square: cell.square });
          }
        }
        if (japanese) {
          if (r === 0) label(String(cols-cell.square.col), tile.position.x, -layout.edgeZ);
          if (c === cols-1) label("一二三四五六七八九"[cell.square.row], layout.edgeX, tile.position.z);
        } else {
          if (r === rows-1) label(String.fromCharCode(97+cell.square.col), tile.position.x, layout.edgeZ);
          if (c === 0) label(String(rows-cell.square.row), -layout.edgeX, tile.position.z);
        }
      }));
      if (japanese && model) {
        for (const slot of shogiHandSlots(layout.width, layout.depth, current.hands, current.orientedRows[0][0].square.row !== 0,frame.compactHands)) {
          const hand = { owner: slot.owner, code: slot.code };
          const light = slot.owner === "sente";
          // Captured tiles always show their unpromoted face, with the new owner's direction.
          const source = model.getObjectByName(pieceModelName("shogi", slot.code, light));
          if (!source) continue;
          const selected = current.selectedHand?.owner === slot.owner && current.selectedHand.code === slot.code;
          const stack = Math.min(3, slot.count);
          for (let i = 0; i < stack; i++) {
            const piece = source.clone(true);
            piece.position.set(slot.x, shogiStandTop + i * .012 + (selected && i === stack - 1 ? .004 : 0), slot.z);
            piece.rotation.y = slot.rotation;
            addPiece(piece, light, { hand });
          }
          // A forgiving invisible touch target covers the slot, not just its sloping tile.
          const hit = new THREE.Mesh(handHitGeometry, hitMaterial);
          hit.position.set(slot.x, shogiStandTop + .011, slot.z); hit.userData.hand = hand; meshes.add(hit);
          if (selected) {
            const halo = new THREE.Mesh(ringGeometry, markerMaterial);
            halo.rotation.x = -Math.PI / 2; halo.position.set(slot.x, shogiStandTop + .0007, slot.z); meshes.add(halo);
          }
          if (slot.count > 1) label(String(slot.count), slot.x + .020, slot.z + .016, true);
        }
      }
      render();
    }
    update.current = redraw;
    function fitAutomaticOrbit() {
      const fitted=fitTabletopBounds(frame.bounds,camera.position.clone().sub(controls.target),frame.aspect);
      adjustingCamera=true;
      camera.position.copy(fitted.position);controls.target.copy(fitted.target);controls.update();
      adjustingCamera=false;
    }
    const resizeView = () => {
      const width=element.clientWidth;if(!width)return;
      const previous=frame;frame=tabletopFrame(props.collection,rows,cols,width,window.innerHeight);
      element.style.aspectRatio=String(frame.aspect);renderer.setSize(width,Math.round(width/frame.aspect));
      camera.aspect=frame.aspect;camera.fov=frame.fieldOfView;camera.updateProjectionMatrix();
      controls.minDistance=frame.distance*.52;controls.maxDistance=frame.maxDistance;
      if(customized) {
        if(automaticOrbit)fitAutomaticOrbit();
        else {
          adjustingCamera=true;
          camera.position.sub(controls.target).multiplyScalar(frame.distance/previous.distance).add(controls.target);controls.update();
          adjustingCamera=false;
        }
      } else applyCamera();
      tabletop.setCompactHands(frame.compactHands);redraw();
      render();
    };
    const resize = new ResizeObserver(resizeView); resize.observe(element);
    window.addEventListener("resize",resizeView);
    controls.addEventListener("change",()=>{if(!adjustingCamera){customized=true;if(automaticOrbit)fitAutomaticOrbit();}render();});
    // Orbit stays fully framed until the user deliberately zooms or pans.
    // Capture listeners run before OrbitControls, including the first wheel tick.
    const cameraPointers=new Set<number>();
    function cameraIntent(event:PointerEvent) {
      cameraPointers.add(event.pointerId);
      if(cameraPointers.size>1||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey)automaticOrbit=false;
    }
    function endCameraPointer(event:PointerEvent){cameraPointers.delete(event.pointerId);}
    function manualZoom(){automaticOrbit=false;}
    renderer.domElement.addEventListener("pointerdown",cameraIntent,true);
    renderer.domElement.addEventListener("pointerup",endCameraPointer,true);
    renderer.domElement.addEventListener("pointercancel",endCameraPointer,true);
    renderer.domElement.addEventListener("wheel",manualZoom,{capture:true,passive:true});
    const gesture=tabletopGesture();
    function down(event: PointerEvent) {
      if (event.button !== 0) return;
      gesture.down(event.pointerId,event.clientX,event.clientY);
    }
    function move(event:PointerEvent) {gesture.move(event.pointerId,event.clientX,event.clientY);}
    function up(event: PointerEvent) {
      if (!gesture.up(event.pointerId,event.clientX,event.clientY) || contextLost || !modelReady) return;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(meshes.children, true).find(item => item.object.userData.square || item.object.userData.hand);
      if (hit?.object.userData.hand) {
        const hand = hit.object.userData.hand as { owner: PlayerColor; code: string };
        latest.current.onChooseHand?.(hand.owner, hand.code);
      } else if (hit) latest.current.onChoose(hit.object.userData.square as Square);
    }
    function cancel(event: PointerEvent) {gesture.cancel(event.pointerId);}
    function lost(event: Event) { event.preventDefault(); contextLost = true; disposeRenderer(); releaseRetiredResources(); fail("The 3D display was interrupted. Continue on the 2D board."); }
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("pointercancel", cancel);
    renderer.domElement.addEventListener("webglcontextlost", lost);
    renderer.domElement.setAttribute("aria-label", `${props.collection === "khmer" ? "Cambodian" : japanese ? props.variantKey === "mini-shogi" ? "Mini Shogi" : "Shogi" : intersection ? props.collection === "xiangqi" ? "Xiangqi" : "Janggi" : jungle ? "Jungle" : historical ? props.collection === "shatranj" ? "Shatranj" : "Chaturanga" : thai ? "Makruk" : papamu ? "Kōnane papamū" : draughts ? props.variantKey === "international-draughts" ? "International draughts" : props.variantKey === "turkish-draughts" ? "Turkish draughts" : "English draughts" : "Classic"} 3D board. Tap pieces and marked squares to move.${japanese ? " Tap captured tiles on the hand stands to drop them." : ""} Drag to orbit. Pinch or use the zoom buttons; move with two fingers or right-drag. Use 2D for keyboard play.`);
    function disposeModel(group: THREE.Group) {
      const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
      const bitmaps = new Set<ImageBitmap>();
      group.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        resources.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          resources.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) {
            resources.add(value);
            if (typeof ImageBitmap !== "undefined" && value.source.data instanceof ImageBitmap) bitmaps.add(value.source.data);
          }
        }
      });
      resources.forEach(resource => resource.dispose());
      bitmaps.forEach(bitmap => bitmap.close());
    }
    new GLTFLoader().load(pieceSetModelPath(props.collection, props.pieceSet ?? "standard") ?? collectionModelPath(props.collection), async gltf => {
      if (disposed) { disposeModel(gltf.scene); return; }
      model = gltf.scene;
      const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.anisotropy = anisotropy;
        }
      });
      if (contextLost) return;
      if ((thai && [true, false].some(side => !model!.getObjectByName(pieceModelName("makruk", "m", side, true)))) || [true, false].some(side => Object.keys(collectionPieces[props.collection]).some(code => !model!.getObjectByName(pieceModelName(props.collection, code, side)) || (japanese && shogiPromotedCodes.has(code) && !model!.getObjectByName(pieceModelName(props.collection, code, side, true)))))) { fail("Some pieces could not load. Continue on the 2D board."); return; }
      try {
        redraw();
        let preparedRevision: number;
        do {
          preparedRevision = sceneRevision;
          await renderer.compileAsync(scene, camera);
          if (disposed || contextLost) return;
        } while (preparedRevision !== sceneRevision);
        modelReady = true;
        render();
        setStatus("Tap to move · drag to orbit · two fingers to zoom & move");
      } catch {
        modelReady = false;
        fail("The 3D display could not finish loading. Continue on the 2D board.");
      }
    }, undefined, () => fail("Pieces could not load. Continue on the 2D board."));
    redraw();
    return () => {
      disposed = true; update.current = null; resetCamera.current = null; zoomCamera.current=null; resize.disconnect(); window.removeEventListener("resize",resizeView); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("pointercancel", cancel); renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.domElement.removeEventListener("pointerdown",cameraIntent,true);renderer.domElement.removeEventListener("pointerup",endCameraPointer,true);renderer.domElement.removeEventListener("pointercancel",endCameraPointer,true);renderer.domElement.removeEventListener("wheel",manualZoom,true);
      disposableMaterials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
      releaseRetiredResources();
      [surfaceGeometry, riverGeometry, tileGeometry, dotGeometry, ringGeometry, promotionGeometry, labelGeometry, handHitGeometry].forEach(geometry => geometry.dispose());
      [hitMaterial, markerMaterial, waterMarkerMaterial, promotionMaterial].forEach(material => material.dispose());
      plainTiles?.flat().forEach(geometry => geometry.dispose());
      gridGeometries.forEach(geometry => geometry.dispose()); gridMaterial.dispose(); japaneseGridMaterial?.dispose();
      if (model) disposeModel(model); jungleTerrain?.dispose(); tabletop.dispose(); disposeRenderer(); renderer.domElement.remove();
    };
  }, [props.collection, props.variantKey, props.pieceSet]);
  return <div className="board-3d-stage">
    <div className="board-3d-camera" role="group" aria-label="3D camera">
      <button type="button" className="focus-ring" aria-label="Zoom out" title="Zoom out" onClick={()=>zoomCamera.current?.(1.2)}><Minus size={17}/></button>
      <button type="button" className="focus-ring" aria-label="Zoom in" title="Zoom in" onClick={()=>zoomCamera.current?.(1/1.2)}><Plus size={17}/></button>
      <button type="button" className="focus-ring" onClick={() => resetCamera.current?.()}><RotateCcw size={14}/>Reset view</button>
    </div>
    <div className="board-3d" data-collection={props.collection} data-tall={getVariant(props.variantKey).board.rows>getVariant(props.variantKey).board.cols||undefined} ref={host} />
    <div className="board-3d-status" role="status">{status}{failed ? <button type="button" className="focus-ring" onClick={props.onFallback}>Use 2D board</button> : null}</div>
  </div>;
}
