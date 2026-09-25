"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { BoardCell, Square } from "@/lib/variants";
import { sameSquare, serializeSquare, getVariant } from "@/lib/variants";
import type { BoardThemePreference } from "./appearance";
import { board3DPalettes, tabletopAspect, tabletopFieldOfView, tabletopCameraPosition, tabletopCameraTarget, collectionPieces, pieceModelName, shogiPromotedCodes, board3DLayout, type PieceCollection, type PieceFinish } from "./board-3d-config";

import { intersectionBoardLines } from "./intersection-board";
import { createTabletopScene } from "./tabletop-scene";

type Props = {
  collection: PieceCollection; variantKey: string; orientedRows: BoardCell[][]; legalTargets: Set<string>;
  selected: Square | null; lastMove?: { from: Square; to: Square }; onChoose: (square: Square) => void;
  boardTheme: BoardThemePreference; finish: PieceFinish;
  onFallback: () => void;
};

export default function Board3D(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const update = useRef<(() => void) | null>(null);
  const resetCamera = useRef<(() => void) | null>(null);
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
    const intersection = props.collection === "xiangqi" || props.collection === "janggi";
    const lettered = japanese || intersection;
    const camera = new THREE.PerspectiveCamera(tabletopFieldOfView, tabletopAspect, .01, 10);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...tabletopCameraTarget); controls.enablePan = false;
    controls.minDistance = .55 * layout.cameraScale; controls.maxDistance = 1.3 * layout.cameraScale;
    controls.minPolarAngle = .45; controls.maxPolarAngle = Math.PI / 2.35;
    function applyCamera() {
      camera.position.set(...tabletopCameraPosition).multiplyScalar(layout.cameraScale);
      controls.target.set(...tabletopCameraTarget); controls.update();
    }
    resetCamera.current = applyCamera; applyCamera();
    const tabletop = createTabletopScene(scene, renderer, layout.width, layout.depth, japanese, props.collection);
    const meshes = new THREE.Group(); scene.add(meshes);
    const grid = new THREE.Group(); scene.add(grid);
    const gridGeometries: THREE.BufferGeometry[] = [];
    const gridMaterial = new THREE.MeshBasicMaterial({ color: 0x50381d });
    if (japanese) {
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
    const tileGeometry = new THREE.BoxGeometry(layout.pitchX - .0005, .004, layout.pitchZ - .0005);
    const shogiTiles = japanese ? Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => {
      const geometry = tileGeometry.clone(), uv = geometry.getAttribute("uv"), positions = geometry.getAttribute("position");
      // One continuous timber surface across the full plain board.
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (positions.getX(i)+(c+.5)*layout.pitchX)/layout.width, 1-(positions.getZ(i)+(r+.5)*layout.pitchZ)/layout.depth);
      return geometry;
    })) : null;
    const dotGeometry = new THREE.CircleGeometry(.0065, 24);
    const ringGeometry = new THREE.RingGeometry(intersection ? .0235 : .018, intersection ? .0255 : .021, 48);
    const riverGeometry = new THREE.PlaneGeometry(.32, .032);
    const promotionGeometry = new THREE.RingGeometry(.0155, .017, 32);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x316a50, side: THREE.DoubleSide });
    const promotionMaterial = new THREE.MeshBasicMaterial({ color: 0xc9a246, side: THREE.DoubleSide });

    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    let model: THREE.Group | null = null;
    let modelReady = false;
    const disposableMaterials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const labelGeometry = new THREE.PlaneGeometry(japanese ? .016 : .012, japanese ? .016 : .012);
    let lastPosition = "";
    const render = () => { if (!disposed && !contextLost) renderer.render(scene, camera); };
    function label(text: string, x: number, z: number) {
      const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 96;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.fillStyle = japanese ? "#302011" : "#dbcbaa"; ctx.font = japanese ? "600 58px sans-serif" : "500 58px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 48, 50);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); textures.push(texture);
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }); disposableMaterials.push(material);
      const plane = new THREE.Mesh(labelGeometry, material); plane.rotation.x = -Math.PI/2; plane.position.set(x, .006, z); plane.userData.coordinate = true; plane.scale.setScalar(Math.min(1.5, Math.max(1, 560 / element!.clientWidth))); meshes.add(plane);
    }
    function redraw() {
      const current = latest.current;
      const position = JSON.stringify([Boolean(model), current.boardTheme, current.finish, current.selected, current.lastMove, [...current.legalTargets], current.orientedRows.map(row => row.map(cell => [cell.square, cell.piece?.owner, cell.piece?.code, cell.piece?.promoted]))]);
      if (position === lastPosition) return;
      lastPosition = position;
      meshes.clear(); disposableMaterials.splice(0).forEach(material => material.dispose()); textures.splice(0).forEach(texture => texture.dispose());
      const finishMaterials = new Map<string, THREE.Material>();
      const palette = board3DPalettes[current.boardTheme];
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
        const isSelected = current.selected && sameSquare(current.selected, cell.square);
        const legal = current.legalTargets.has(serializeSquare(cell.square));
        const last = current.lastMove && (sameSquare(current.lastMove.from, cell.square) || sameSquare(current.lastMove.to, cell.square));
        const color = new THREE.Color(japanese && current.boardTheme === "wood" ? 0xd9b77d : palette[current.collection !== "classic" ? 0 : (cell.square.row + cell.square.col) % 2]);
        const objective = current.variantKey === "king-of-the-hill" && [3,4].includes(cell.square.row) && [3,4].includes(cell.square.col) || current.variantKey === "racing-kings" && cell.square.row === 0;
        if (objective) color.lerp(new THREE.Color(0xd6a648), .4);
        if (last) color.lerp(new THREE.Color(0xd9bb45), .35);
        if (isSelected) color.set(0xd5b64b);
        const material = intersection ? hitMaterial : new THREE.MeshPhysicalMaterial({ color, map: tabletop.grain, bumpMap: tabletop.grain, bumpScale: .000025, roughness: .34, clearcoat: .4, clearcoatRoughness: .28 }); if (!intersection) disposableMaterials.push(material);
        const tile = new THREE.Mesh(shogiTiles?.[r][c] ?? tileGeometry, material); tile.position.set((c-(cols-1)/2)*layout.pitchX, 0, (r-(rows-1)/2)*layout.pitchZ); tile.userData.square = cell.square; tile.receiveShadow = !intersection; meshes.add(tile);
        if (intersection && (isSelected || last)) {
          const material = new THREE.MeshBasicMaterial({ color: isSelected ? 0x9b5e00 : 0xb08a36, side: THREE.DoubleSide }); disposableMaterials.push(material);
          const halo = new THREE.Mesh(ringGeometry, material); halo.rotation.x = -Math.PI/2; halo.position.set(tile.position.x,.0027,tile.position.z); meshes.add(halo);
        }
        if (legal || (cell.piece?.promoted && !japanese)) {
          const marker = new THREE.Mesh(legal ? cell.piece ? ringGeometry : dotGeometry : promotionGeometry, legal ? markerMaterial : promotionMaterial);
          marker.rotation.x = -Math.PI/2; marker.position.set(tile.position.x, .0028, tile.position.z); marker.userData.square = cell.square; meshes.add(marker);
        }
        if (cell.piece && model) {
          const light = cell.piece.owner === getVariant(current.variantKey).players[0];
          const name = pieceModelName(current.collection, cell.piece.code, light, cell.piece.promoted);
          const source = model.getObjectByName(name);
          if (source) {
            const piece = source.clone(true); piece.position.set(tile.position.x, .002, tile.position.z);
            if (current.collection === "classic" || lettered) piece.rotation.y = ((light !== (current.orientedRows[0][0].square.row === 0)) ? Math.PI : 0) + (current.collection === "classic" && cell.piece.code === "n" ? Math.PI/4 : 0);
            piece.traverse(child => {
              child.userData.square = cell.square;
              if (!(child instanceof THREE.Mesh)) return;
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              const paintedInk = lettered && materials.every(material => /ink/i.test(material.name));
              child.castShadow = !paintedInk; child.receiveShadow = !paintedInk;
              if (current.finish === "original" && !(japanese || current.collection === "xiangqi")) return;
              const finish = (original: THREE.Material) => {
                if (!(original instanceof THREE.MeshStandardMaterial) || /brass|inlay|felt|ink/i.test(original.name)) return original;
                const id = `${original.uuid}:${light}`;
                let changed = finishMaterials.get(id);
                if (!changed) {
                  const copy = original.clone();
                  if (japanese || current.collection === "xiangqi") { copy.map = tabletop.grain; copy.bumpMap = tabletop.grain; copy.bumpScale = .000035; }
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
        }
        if (japanese) {
          if (r === 0) label(String(cols-cell.square.col), tile.position.x, -layout.edgeZ);
          if (c === cols-1) label("一二三四五六七八九"[cell.square.row], layout.edgeX, tile.position.z);
        } else {
          if (r === rows-1) label(String.fromCharCode(97+cell.square.col), tile.position.x, layout.edgeZ);
          if (c === 0) label(String(rows-cell.square.row), -layout.edgeX, tile.position.z);
        }
      }));
      render();
    }
    update.current = redraw;
    const resize = new ResizeObserver(() => { const width = element.clientWidth; renderer.setSize(width, Math.round(width / tabletopAspect)); camera.aspect = tabletopAspect; camera.updateProjectionMatrix(); meshes.children.filter(mesh => mesh.userData.coordinate).forEach(mesh => mesh.scale.setScalar(Math.min(1.5, Math.max(1, 560 / width)))); render(); }); resize.observe(element);
    controls.addEventListener("change", render);
    const pointers = new Map<number, { x: number; y: number }>(); let gesture = false;
    function down(event: PointerEvent) {
      if (event.button !== 0) return;
      if (!pointers.size) gesture = false;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size > 1) gesture = true;
    }
    function up(event: PointerEvent) {
      const start = pointers.get(event.pointerId); pointers.delete(event.pointerId);
      if (!start || gesture || contextLost || !modelReady || Math.hypot(event.clientX-start.x, event.clientY-start.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(meshes.children, true).find(item => item.object.userData.square);
      if (hit) latest.current.onChoose(hit.object.userData.square as Square);
    }
    function cancel(event: PointerEvent) { pointers.delete(event.pointerId); gesture = true; }
    function lost(event: Event) { event.preventDefault(); contextLost = true; fail("The 3D display was interrupted. Continue on the 2D board."); }
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("pointercancel", cancel);
    renderer.domElement.addEventListener("webglcontextlost", lost);
    renderer.domElement.setAttribute("aria-label", `${props.collection === "khmer" ? "Cambodian" : japanese ? props.variantKey === "mini-shogi" ? "Mini Shogi" : "Shogi" : intersection ? props.collection === "xiangqi" ? "Xiangqi" : "Janggi" : "Classic"} 3D board. Tap pieces and marked squares to move. Drag to orbit. Use 2D for keyboard play.`);
    function disposeModel(group: THREE.Group) { group.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } }); }
    new GLTFLoader().load(`/assets/${props.collection}/collection.glb`, gltf => {
      if (disposed) { disposeModel(gltf.scene); return; }
      model = gltf.scene;
      if (contextLost) return;
      if ([true, false].some(side => Object.keys(collectionPieces[props.collection]).some(code => !model!.getObjectByName(pieceModelName(props.collection, code, side)) || (japanese && shogiPromotedCodes.has(code) && !model!.getObjectByName(pieceModelName(props.collection, code, side, true)))))) { fail("Some pieces could not load. Continue on the 2D board."); return; }
      modelReady = true;
      setStatus("Tap to move · drag to orbit · pinch to zoom"); redraw();
    }, undefined, () => fail("Pieces could not load. Continue on the 2D board."));
    redraw();
    return () => {
      disposed = true; update.current = null; resetCamera.current = null; resize.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("pointercancel", cancel); renderer.domElement.removeEventListener("webglcontextlost", lost);
      disposableMaterials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
      [surfaceGeometry, riverGeometry, tileGeometry, dotGeometry, ringGeometry, promotionGeometry, labelGeometry].forEach(geometry => geometry.dispose());
      [hitMaterial, markerMaterial, promotionMaterial].forEach(material => material.dispose());
      shogiTiles?.flat().forEach(geometry => geometry.dispose());
      gridGeometries.forEach(geometry => geometry.dispose()); gridMaterial.dispose();
      if (model) disposeModel(model); tabletop.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, [props.collection, props.variantKey]);
  return <div className="board-3d-stage">
    <div className="board-3d-camera" role="group" aria-label="3D camera">
      <button type="button" className="focus-ring" onClick={() => resetCamera.current?.()}>Reset view</button>
    </div>
    <div className="board-3d" ref={host} />
    <div className="board-3d-status" role="status">{status}{failed ? <button type="button" className="focus-ring" onClick={props.onFallback}>Use 2D board</button> : null}</div>
  </div>;
}
