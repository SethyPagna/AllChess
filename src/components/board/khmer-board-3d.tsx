"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { BoardCell, Square } from "@/lib/variants";
import { serializeSquare } from "@/lib/variants";

type Props = { orientedRows: BoardCell[][]; legalTargets: Set<string>; selected: Square | null; onChoose: (square: Square) => void; boardTheme: string };
const pieceNames: Record<string, string> = { k: "Khon_king", m: "Neang_queen", s: "Koul_bishop", n: "Ses_horse", r: "Touk_boat", p: "Trey_fish" };

export default function KhmerBoard3D(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const update = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState("Loading carved pieces…");
  useEffect(() => { latest.current = props; update.current?.(); }, [props]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { queueMicrotask(() => setStatus("3D is unavailable on this device. Choose 2D above.")); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xded8cd, 1);
    element.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, .01, 10);
    camera.position.set(0, .62, .65);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, .01, 0); controls.enablePan = false; controls.minDistance = .55; controls.maxDistance = 1.3; controls.minPolarAngle = .1; controls.maxPolarAngle = Math.PI / 2.6;
    controls.update();
    scene.add(new THREE.HemisphereLight(0xfff7e7, 0x635345, 2.6));
    const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(-.3, .6, .4); scene.add(key);
    const meshes = new THREE.Group(); scene.add(meshes);
    const tileGeometry = new THREE.BoxGeometry(.0525, .004, .0525);
    const baseGeometry = new THREE.BoxGeometry(.438, .014, .438);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x553f2e, roughness: .6 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial); base.position.y = -.009; scene.add(base);
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    let model: THREE.Group | null = null;
    const tileMaterials: THREE.Material[] = [];
    let lastPosition = "";
    const render = () => { if (!disposed) renderer.render(scene, camera); };
    function redraw() {
      const current = latest.current;
      const position = JSON.stringify([Boolean(model), current.boardTheme, current.selected, [...current.legalTargets], current.orientedRows.map(row => row.map(cell => [cell.square, cell.piece?.owner, cell.piece?.code, cell.piece?.promoted]))]);
      if (position === lastPosition) return;
      lastPosition = position;
      meshes.clear(); tileMaterials.splice(0).forEach(material => material.dispose());
      const palette: Record<string, number> = { wood: 0xd6b782, jade: 0xa9b99c, contrast: 0xece8dc, slate: 0xa5b3bc, plum: 0xc6afc2, ocean: 0xadc8cf };
      current.orientedRows.forEach((row, r) => row.forEach((cell, c) => {
        const isSelected = current.selected?.row === cell.square.row && current.selected?.col === cell.square.col;
        const legal = current.legalTargets.has(serializeSquare(cell.square));
        const material = new THREE.MeshStandardMaterial({ color: isSelected ? 0xcfaf42 : legal ? 0x87a475 : palette[current.boardTheme] ?? 0xd6b782, roughness: .82 }); tileMaterials.push(material);
        const tile = new THREE.Mesh(tileGeometry, material); tile.position.set((c - 3.5) * .053, 0, (r - 3.5) * .053); tile.userData.square = cell.square; meshes.add(tile);
        if (cell.piece && model) {
          const name = `${cell.piece.owner === "white" ? "light" : "dark"}_${pieceNames[cell.piece.code] ?? "Trey_fish"}`;
          const source = model.getObjectByName(name);
          if (source) { const piece = source.clone(true); piece.position.set(tile.position.x, .002, tile.position.z); piece.userData.square = cell.square; piece.traverse(child => { child.userData.square = cell.square; }); meshes.add(piece); }
        }
      }));
      render();
    }
    update.current = redraw;
    const resize = new ResizeObserver(() => { const width = element.clientWidth; renderer.setSize(width, width); camera.aspect = 1; camera.updateProjectionMatrix(); render(); }); resize.observe(element);
    controls.addEventListener("change", render);
    let start = { x: 0, y: 0 };
    function down(event: PointerEvent) { start = { x: event.clientX, y: event.clientY }; }
    function up(event: PointerEvent) {
      if (Math.hypot(event.clientX-start.x, event.clientY-start.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(meshes.children, true).find(item => item.object.userData.square);
      if (hit) latest.current.onChoose(hit.object.userData.square as Square);
    }
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.setAttribute("aria-label", "Cambodian 3D board. Tap pieces and highlighted squares to move. Drag to orbit. Use 2D for keyboard play.");
    function disposeModel(group: THREE.Group) { group.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } }); }
    new GLTFLoader().load("/assets/khmer/collection.glb", gltf => { if (disposed) { disposeModel(gltf.scene); return; } model = gltf.scene; setStatus("Tap to move · drag to orbit · pinch to zoom"); redraw(); }, undefined, () => { if (!disposed) setStatus("Pieces could not load. Choose 2D above to continue."); });
    redraw();
    return () => { disposed = true; update.current = null; resize.disconnect(); controls.dispose(); renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointerup", up); tileMaterials.forEach(material => material.dispose()); tileGeometry.dispose(); baseGeometry.dispose(); baseMaterial.dispose(); if (model) disposeModel(model); renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  return <div className="board-3d" ref={host}><span className="board-3d-status" role="status">{status}</span></div>;
}
