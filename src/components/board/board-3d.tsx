"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { BoardCell, Square } from "@/lib/variants";
import { sameSquare, serializeSquare } from "@/lib/variants";
import type { BoardThemePreference } from "./appearance";
import { board3DPalettes, cameraPositions, collectionPieces, type CameraView, type PieceCollection, type PieceFinish } from "./board-3d-config";

type Props = {
  collection: PieceCollection; variantKey: string; orientedRows: BoardCell[][]; legalTargets: Set<string>;
  selected: Square | null; lastMove?: { from: Square; to: Square }; onChoose: (square: Square) => void;
  boardTheme: BoardThemePreference; finish: PieceFinish; cameraView: CameraView;
  onCameraChange: (view: CameraView) => void; onFallback: () => void;
};

export default function Board3D(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const update = useRef<(() => void) | null>(null);
  const resetCamera = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState("Loading carved pieces…");
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
    renderer.setClearColor(0xded8cd, 1);
    renderer.toneMapping = THREE.NeutralToneMapping;
    element.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, .01, 10);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, .01, 0); controls.enablePan = false;
    controls.minDistance = .55; controls.maxDistance = 1.3;
    controls.minPolarAngle = .001; controls.maxPolarAngle = Math.PI / 2.6;
    let appliedCamera: CameraView | null = null;
    function applyCamera() {
      appliedCamera = latest.current.cameraView;
      camera.position.set(...cameraPositions[appliedCamera]);
      controls.target.set(0, .01, 0); controls.update();
    }
    resetCamera.current = applyCamera; applyCamera();
    scene.add(new THREE.HemisphereLight(0xfff7e7, 0x635345, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-.3, .6, .4); scene.add(key);
    const meshes = new THREE.Group(); scene.add(meshes);
    const tileGeometry = new THREE.BoxGeometry(.0525, .004, .0525);
    const baseGeometry = new THREE.BoxGeometry(.46, .014, .46);
    const dotGeometry = new THREE.CircleGeometry(.0065, 24);
    const ringGeometry = new THREE.RingGeometry(.018, .021, 32);
    const promotionGeometry = new THREE.RingGeometry(.0155, .017, 32);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x553f2e, roughness: .6 });
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x316a50, side: THREE.DoubleSide });
    const promotionMaterial = new THREE.MeshBasicMaterial({ color: 0xc9a246, side: THREE.DoubleSide });
    const base = new THREE.Mesh(baseGeometry, baseMaterial); base.position.y = -.009; scene.add(base);
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    let model: THREE.Group | null = null;
    let modelReady = false;
    const disposableMaterials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const labelGeometry = new THREE.PlaneGeometry(.014, .014);
    let lastPosition = "";
    const render = () => { if (!disposed && !contextLost) renderer.render(scene, camera); };
    function label(text: string, x: number, z: number) {
      const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 96;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.fillStyle = "#fff4da"; ctx.font = "bold 64px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 48, 50);
      const texture = new THREE.CanvasTexture(canvas); textures.push(texture);
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }); disposableMaterials.push(material);
      const plane = new THREE.Mesh(labelGeometry, material); plane.rotation.x = -Math.PI/2; plane.position.set(x, .002, z); meshes.add(plane);
    }
    function redraw() {
      const current = latest.current;
      if (appliedCamera !== current.cameraView) applyCamera();
      const position = JSON.stringify([Boolean(model), current.boardTheme, current.finish, current.selected, current.lastMove, [...current.legalTargets], current.orientedRows.map(row => row.map(cell => [cell.square, cell.piece?.owner, cell.piece?.code, cell.piece?.promoted]))]);
      if (position === lastPosition) return;
      lastPosition = position;
      meshes.clear(); disposableMaterials.splice(0).forEach(material => material.dispose()); textures.splice(0).forEach(texture => texture.dispose());
      const finishMaterials = new Map<string, THREE.Material>();
      const palette = board3DPalettes[current.boardTheme];
      current.orientedRows.forEach((row, r) => row.forEach((cell, c) => {
        const isSelected = current.selected && sameSquare(current.selected, cell.square);
        const legal = current.legalTargets.has(serializeSquare(cell.square));
        const last = current.lastMove && (sameSquare(current.lastMove.from, cell.square) || sameSquare(current.lastMove.to, cell.square));
        const color = new THREE.Color(palette[current.collection === "khmer" ? 0 : (cell.square.row + cell.square.col) % 2]);
        const objective = current.variantKey === "king-of-the-hill" && [3,4].includes(cell.square.row) && [3,4].includes(cell.square.col) || current.variantKey === "racing-kings" && cell.square.row === 0;
        if (objective) color.lerp(new THREE.Color(0xd6a648), .4);
        if (last) color.lerp(new THREE.Color(0xd9bb45), .35);
        if (isSelected) color.set(0xd5b64b);
        const material = new THREE.MeshStandardMaterial({ color, roughness: .82 }); disposableMaterials.push(material);
        const tile = new THREE.Mesh(tileGeometry, material); tile.position.set((c-3.5)*.053, 0, (r-3.5)*.053); tile.userData.square = cell.square; meshes.add(tile);
        if (legal || cell.piece?.promoted) {
          const marker = new THREE.Mesh(legal ? cell.piece ? ringGeometry : dotGeometry : promotionGeometry, legal ? markerMaterial : promotionMaterial);
          marker.rotation.x = -Math.PI/2; marker.position.set(tile.position.x, .0028, tile.position.z); marker.userData.square = cell.square; meshes.add(marker);
        }
        if (cell.piece && model) {
          const light = cell.piece.owner === "white";
          const name = `${light ? "light" : "dark"}_${collectionPieces[current.collection][cell.piece.code]}`;
          const source = model.getObjectByName(name);
          if (source) {
            const piece = source.clone(true); piece.position.set(tile.position.x, .002, tile.position.z);
            if (current.collection === "classic") piece.rotation.y = ((light !== (current.orientedRows[0][0].square.row === 0)) ? Math.PI : 0) + (cell.piece.code === "n" ? Math.PI/4 : 0);
            piece.traverse(child => {
              child.userData.square = cell.square;
              if (current.finish === "original" || !(child instanceof THREE.Mesh)) return;
              const finish = (original: THREE.Material) => {
                if (!(original instanceof THREE.MeshStandardMaterial) || /brass|inlay|felt/i.test(original.name)) return original;
                const id = `${original.uuid}:${light}`;
                let changed = finishMaterials.get(id);
                if (!changed) {
                  const copy = original.clone();
                  copy.color.set(current.finish === "porcelain" ? light ? 0xfff7e6 : 0x24313b : light ? 0xe2e9e9 : 0x385773);
                  copy.roughness = current.finish === "porcelain" ? .2 : .65; copy.metalness = 0;
                  changed = copy; finishMaterials.set(id, copy); disposableMaterials.push(copy);
                }
                return changed;
              };
              child.material = Array.isArray(child.material) ? child.material.map(finish) : finish(child.material);
            }); meshes.add(piece);
          }
        }
        if (r === 7) label(String.fromCharCode(97+cell.square.col), tile.position.x, .222);
        if (c === 0) label(String(8-cell.square.row), -.222, tile.position.z);
      }));
      render();
    }
    update.current = redraw;
    const resize = new ResizeObserver(() => { const width = element.clientWidth; renderer.setSize(width, width); camera.aspect = 1; camera.updateProjectionMatrix(); render(); }); resize.observe(element);
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
    renderer.domElement.setAttribute("aria-label", `${props.collection === "khmer" ? "Cambodian" : "Classic"} 3D board. Tap pieces and marked squares to move. Drag to orbit. Use 2D for keyboard play.`);
    function disposeModel(group: THREE.Group) { group.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } }); }
    new GLTFLoader().load(`/assets/${props.collection}/collection.glb`, gltf => {
      if (disposed) { disposeModel(gltf.scene); return; }
      model = gltf.scene;
      if (contextLost) return;
      if (["light", "dark"].some(side => Object.values(collectionPieces[props.collection]).some(name => !model!.getObjectByName(`${side}_${name}`)))) { fail("Some pieces could not load. Continue on the 2D board."); return; }
      modelReady = true;
      setStatus("Tap to move · drag to orbit · pinch to zoom"); redraw();
    }, undefined, () => fail("Pieces could not load. Continue on the 2D board."));
    redraw();
    return () => {
      disposed = true; update.current = null; resetCamera.current = null; resize.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("pointercancel", cancel); renderer.domElement.removeEventListener("webglcontextlost", lost);
      disposableMaterials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
      [tileGeometry, baseGeometry, dotGeometry, ringGeometry, promotionGeometry, labelGeometry].forEach(geometry => geometry.dispose());
      [baseMaterial, markerMaterial, promotionMaterial].forEach(material => material.dispose());
      if (model) disposeModel(model); renderer.dispose(); renderer.domElement.remove();
    };
  }, [props.collection]);
  return <div className="board-3d-stage">
    <div className="board-3d-camera" role="group" aria-label="3D camera">
      <button type="button" className="focus-ring" aria-pressed={props.cameraView === "angled"} onClick={() => { props.onCameraChange("angled"); if (props.cameraView === "angled") resetCamera.current?.(); }}>Angled</button>
      <button type="button" className="focus-ring" aria-pressed={props.cameraView === "top"} onClick={() => { props.onCameraChange("top"); if (props.cameraView === "top") resetCamera.current?.(); }}>Top</button>
      <button type="button" className="focus-ring" onClick={() => resetCamera.current?.()}>Reset view</button>
    </div>
    <div className="board-3d" ref={host} />
    <div className="board-3d-status" role="status">{status}{failed ? <button type="button" className="focus-ring" onClick={props.onFallback}>Use 2D board</button> : null}</div>
  </div>;
}
