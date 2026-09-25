"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { BoardCell, GameState, PlayerColor, Square } from "@/lib/variants";
import { sameSquare, serializeSquare, getVariant } from "@/lib/variants";
import type { BoardThemePreference } from "./appearance";
import { board3DPalettes, collectionPieces, pieceModelName, shogiPromotedCodes, board3DLayout, type PieceCollection, type PieceFinish } from "./board-3d-config";
import { tabletopFrame } from "./tabletop-camera";
import { tabletopGesture } from "./tabletop-gesture";

import { createKonaneCellGeometry } from "./konane-board";
import { createJungleTerrainKit, jungleWaterTop } from "./jungle-board";
import { intersectionBoardLines } from "./intersection-board";
import { createTabletopScene } from "./tabletop-scene";
import { shogiHandSlots, shogiStandTop } from "./shogi-stands";

type Props = {
  collection: PieceCollection; variantKey: string; orientedRows: BoardCell[][]; legalTargets: Set<string>;
  selected: Square | null; lastMove?: { from: Square; to: Square }; onChoose: (square: Square) => void;
  boardTheme: BoardThemePreference; finish: PieceFinish;
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
    const plainGrid = japanese || thai || historical || props.variantKey === "turkish-draughts";
    const checkered = props.collection === "classic" || (draughts && !plainGrid);
    const intersection = props.collection === "xiangqi" || props.collection === "janggi";
    const lettered = japanese || intersection;
    let frame=tabletopFrame(props.collection,rows,cols,element.clientWidth||640,window.innerHeight);
    let customized=false, adjustingCamera=false;
    const camera = new THREE.PerspectiveCamera(frame.fieldOfView, frame.aspect, .01, 10);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(frame.target); controls.enablePan = true; controls.screenSpacePanning=false;
    controls.cursor.copy(frame.target); controls.maxTargetRadius=Math.max(layout.width,layout.depth);
    controls.minDistance = frame.distance*.52; controls.maxDistance = frame.distance*1.65;
    controls.minPolarAngle = .45; controls.maxPolarAngle = Math.PI / 2.35;
    function applyCamera() {
      adjustingCamera=true; customized=false;
      camera.position.copy(frame.position); controls.target.copy(frame.target); controls.update();
      adjustingCamera=false;
    }
    resetCamera.current = applyCamera; applyCamera();
    zoomCamera.current=factor=>{
      const offset=camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));
      camera.position.copy(controls.target).add(offset);controls.update();
    };
    const tabletop = createTabletopScene(scene, renderer, layout.width, layout.depth, japanese, props.collection);
    tabletop.setCompactHands(frame.compactHands);
    const meshes = new THREE.Group(); scene.add(meshes);
    const grid = new THREE.Group(); scene.add(grid);
    const gridGeometries: THREE.BufferGeometry[] = [];
    const gridMaterial = new THREE.MeshBasicMaterial({ color: 0x50381d });
    if (plainGrid) {
      const vertical = new THREE.BoxGeometry(.0006, .0005, layout.depth), horizontal = new THREE.BoxGeometry(layout.width, .0005, .0006);
      gridGeometries.push(vertical, horizontal);
      for (let c = 0; c <= cols; c++) { const line = new THREE.Mesh(vertical, gridMaterial); line.position.set((c-cols/2)*layout.pitchX, .0021, 0); grid.add(line); }
      for (let r = 0; r <= rows; r++) { const line = new THREE.Mesh(horizontal, gridMaterial); line.position.set(0, .0021, (r-rows/2)*layout.pitchZ); grid.add(line); }
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
    const plainTiles = (plainGrid || papamu) ? Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => {
      const geometry = tileGeometry.clone(), uv = geometry.getAttribute("uv"), positions = geometry.getAttribute("position");
      // One continuous timber surface across the full plain board.
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
    const labelGeometry = new THREE.PlaneGeometry(japanese ? .016 : .012, japanese ? .016 : .012);
    const handHitGeometry = new THREE.BoxGeometry(.047, .022, .048);
    let lastPosition = "";
    const render = () => { if (!disposed && !contextLost) renderer.render(scene, camera); };
    function label(text: string, x: number, z: number, hand = false) {
      const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 96;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.fillStyle = japanese ? "#302011" : "#dbcbaa"; ctx.font = japanese ? "600 58px sans-serif" : "500 58px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 48, 50);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); textures.push(texture);
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }); disposableMaterials.push(material);
      const plane = new THREE.Mesh(labelGeometry, material); plane.rotation.x = -Math.PI/2; plane.position.set(x, .006, z); plane.userData.coordinate = !hand; plane.scale.setScalar(hand ? .7 : Math.min(1.5, Math.max(1, 560 / element!.clientWidth))); meshes.add(plane);
    }
    function redraw() {
      const current = latest.current;
      const position = JSON.stringify([Boolean(model), frame.compactHands, current.boardTheme, current.finish, current.selected, current.lastMove, current.hands, current.selectedHand, [...current.legalTargets], current.orientedRows.map(row => row.map(cell => [cell.square, cell.terrain, cell.piece?.owner, cell.piece?.code, cell.piece?.promoted]))]);
      if (position === lastPosition) return;
      lastPosition = position;
      meshes.clear(); disposableMaterials.splice(0).forEach(material => material.dispose()); textures.splice(0).forEach(texture => texture.dispose());
      const finishMaterials = new Map<string, THREE.Material>();
      const palette = board3DPalettes[current.boardTheme];
      function addPiece(piece: THREE.Object3D, light: boolean, target: Record<string, unknown>) {
        piece.traverse(child => {
          Object.assign(child.userData, target);
          if (!(child instanceof THREE.Mesh)) return;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          const paintedInk = lettered && materials.every(material => /ink/i.test(material.name));
          child.castShadow = !paintedInk; child.receiveShadow = !paintedInk;
          if (current.finish === "original" && !(japanese || current.collection === "xiangqi" || draughts)) return;
          const finish = (original: THREE.Material) => {
            if (!(original instanceof THREE.MeshStandardMaterial) || /brass|inlay|felt|ink/i.test(original.name)) return original;
            const id = `${original.uuid}:${light}`;
            let changed = finishMaterials.get(id);
            if (!changed) {
              const copy = original.clone();
              if (japanese || current.collection === "xiangqi" || draughts) { copy.map = tabletop.grain; copy.bumpMap = tabletop.grain; copy.bumpScale = .000035; }
              if (current.finish !== "original") {
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
        const surfaceMaterial = new THREE.MeshPhysicalMaterial({ color: current.boardTheme === "wood" ? 0xd5b987 : palette[0], map: tabletop.grain, bumpMap: tabletop.grain, bumpScale: .000025, roughness: .46, clearcoat: .2 }); disposableMaterials.push(surfaceMaterial);
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
        const color = new THREE.Color((japanese || (draughts && plainGrid)) && current.boardTheme === "wood" ? 0xd9b77d : palette[checkered ? (cell.square.row + cell.square.col) % 2 : 0]);
        if (water) color.set(0x236e78);
        const objective = current.variantKey === "king-of-the-hill" && [3,4].includes(cell.square.row) && [3,4].includes(cell.square.col) || current.variantKey === "racing-kings" && cell.square.row === 0;
        if (objective) color.lerp(new THREE.Color(0xd6a648), .4);
        if (last) color.lerp(new THREE.Color(0xd9bb45), .35);
        if (isSelected) color.set(0xd5b64b);
        const material = intersection ? hitMaterial : new THREE.MeshPhysicalMaterial({ color, map: water ? null : tabletop.grain, bumpMap: water ? null : tabletop.grain, bumpScale: .000025, roughness: water ? .16 : papamu ? .55 : .34, clearcoat: water ? .9 : papamu ? .12 : .4, clearcoatRoughness: .28 }); if (!intersection) disposableMaterials.push(material);
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
    const resizeView = () => {
      const width=element.clientWidth;if(!width)return;
      const previous=frame;frame=tabletopFrame(props.collection,rows,cols,width,window.innerHeight);
      element.style.aspectRatio=String(frame.aspect);renderer.setSize(width,Math.round(width/frame.aspect));
      camera.aspect=frame.aspect;camera.fov=frame.fieldOfView;camera.updateProjectionMatrix();
      controls.minDistance=frame.distance*.52;controls.maxDistance=frame.distance*1.65;
      if(customized) {
        adjustingCamera=true;
        camera.position.sub(controls.target).multiplyScalar(frame.distance/previous.distance).add(controls.target);controls.update();
        adjustingCamera=false;
      } else applyCamera();
      tabletop.setCompactHands(frame.compactHands);redraw();
      meshes.children.filter(mesh=>mesh.userData.coordinate).forEach(mesh=>mesh.scale.setScalar(Math.min(1.5,Math.max(1,560/width))));render();
    };
    const resize = new ResizeObserver(resizeView); resize.observe(element);
    window.addEventListener("resize",resizeView);
    controls.addEventListener("change",()=>{if(!adjustingCamera)customized=true;render();});
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
    function lost(event: Event) { event.preventDefault(); contextLost = true; fail("The 3D display was interrupted. Continue on the 2D board."); }
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("pointercancel", cancel);
    renderer.domElement.addEventListener("webglcontextlost", lost);
    renderer.domElement.setAttribute("aria-label", `${props.collection === "khmer" ? "Cambodian" : japanese ? props.variantKey === "mini-shogi" ? "Mini Shogi" : "Shogi" : intersection ? props.collection === "xiangqi" ? "Xiangqi" : "Janggi" : jungle ? "Jungle" : historical ? props.collection === "shatranj" ? "Shatranj" : "Chaturanga" : thai ? "Makruk" : papamu ? "Kōnane papamū" : draughts ? props.variantKey === "international-draughts" ? "International draughts" : props.variantKey === "turkish-draughts" ? "Turkish draughts" : "English draughts" : "Classic"} 3D board. Tap pieces and marked squares to move.${japanese ? " Tap captured tiles on the hand stands to drop them." : ""} Drag to orbit. Pinch or use the zoom buttons; move with two fingers or right-drag. Use 2D for keyboard play.`);
    function disposeModel(group: THREE.Group) { group.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } }); }
    new GLTFLoader().load(`/assets/${props.collection}/collection.glb`, gltf => {
      if (disposed) { disposeModel(gltf.scene); return; }
      model = gltf.scene;
      if (contextLost) return;
      if ((thai && [true, false].some(side => !model!.getObjectByName(pieceModelName("makruk", "m", side, true)))) || [true, false].some(side => Object.keys(collectionPieces[props.collection]).some(code => !model!.getObjectByName(pieceModelName(props.collection, code, side)) || (japanese && shogiPromotedCodes.has(code) && !model!.getObjectByName(pieceModelName(props.collection, code, side, true)))))) { fail("Some pieces could not load. Continue on the 2D board."); return; }
      modelReady = true;
      setStatus("Tap to move · drag to orbit · two fingers to zoom & move"); redraw();
    }, undefined, () => fail("Pieces could not load. Continue on the 2D board."));
    redraw();
    return () => {
      disposed = true; update.current = null; resetCamera.current = null; zoomCamera.current=null; resize.disconnect(); window.removeEventListener("resize",resizeView); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("pointercancel", cancel); renderer.domElement.removeEventListener("webglcontextlost", lost);
      disposableMaterials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
      [surfaceGeometry, riverGeometry, tileGeometry, dotGeometry, ringGeometry, promotionGeometry, labelGeometry, handHitGeometry].forEach(geometry => geometry.dispose());
      [hitMaterial, markerMaterial, waterMarkerMaterial, promotionMaterial].forEach(material => material.dispose());
      plainTiles?.flat().forEach(geometry => geometry.dispose());
      gridGeometries.forEach(geometry => geometry.dispose()); gridMaterial.dispose();
      if (model) disposeModel(model); jungleTerrain?.dispose(); tabletop.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, [props.collection, props.variantKey]);
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
