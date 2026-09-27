import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { shogiStands } from "./shogi-stands";

/** Small, deterministic grain map. No external textures or continuous render loop. */
function woodGrain() {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const pixels = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const bend = Math.sin(x*.011)*3 + Math.sin(x*.031+y*.012)*1.5;
    const grain = Math.sin((y+bend)*.6)*3 + Math.sin((y+bend)*.08)*4;
    const pore = Math.sin(x*12.9898+y*78.233)*43758.5453;
    const value = Math.round(224+grain+(pore-Math.floor(pore))*2);
    const i = (y*canvas.width+x)*4;
    pixels.data[i] = value; pixels.data[i+1] = value; pixels.data[i+2] = value; pixels.data[i+3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createTabletopScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer, width = .424, depth = .424, japanese = false, collection = "classic", onTextureReady = () => {}, boardSurfacePath?: string) {
  let disposed = false;
  const woodTextures: THREE.Texture[] = [];
  function woodTexture(name: string, colour = false) {
    const texture = new THREE.TextureLoader().load(`/assets/materials/wood-table/${name}.jpg`, loaded => {
      if (disposed) loaded.dispose();
      else onTextureReady();
    }, undefined, () => { /* The solid material remains playable if a texture cannot load. */ });
    texture.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    woodTextures.push(texture);
    return texture;
  }
  const stainedTimber = ["classic", "khmer", "makruk", "chaturanga", "konane"].includes(collection);
  const caseColour = stainedTimber ? woodTexture("colour", true) : null;
  const woodNormal = woodTexture("normal");
  const woodRoughness = woodTexture("roughness");
  const grain = woodGrain();
  grain.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let boardSurfaceReady = false, usingBoardSurface = false;
  const boardSurface = boardSurfacePath ? new THREE.TextureLoader().load(boardSurfacePath, loaded => {
    if (disposed) { loaded.dispose(); return; }
    boardSurfaceReady = true;
    onTextureReady();
  }, undefined, () => { /* Retain the native grain if the optional artwork fails. */ }) : null;
  if (boardSurface) {
    boardSurface.colorSpace = THREE.SRGBColorSpace;
    boardSurface.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    woodTextures.push(boardSurface);
  }
  const environment = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const environmentMap = generator.fromScene(environment, .04);
  scene.environment = environmentMap.texture; scene.environmentIntensity = .65;
  environment.dispose(); generator.dispose();
  scene.background = new THREE.Color(0x171b1a);
  scene.fog = new THREE.Fog(0x171b1a, 1.8, 4);
  const group = new THREE.Group(); scene.add(group);
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const handStands:Array<{compact:boolean;meshes:THREE.Mesh[]}>=[];
  const walnut = new THREE.MeshPhysicalMaterial({ color: japanese ? 0xc79b57 : collection === "jungle" ? 0x17473b : collection === "janggi" ? 0x21433a : collection === "xiangqi" ? 0x512d25 : collection === "makruk" ? 0x654028 : collection === "shatranj" ? 0x17434b : collection === "chaturanga" ? 0x63392b : 0x493022, map: grain, bumpMap: grain, bumpScale: .00015, roughness: japanese ? .48 : .32, clearcoat: japanese ? .2 : .6, clearcoatRoughness: .28 });
  const edge = new THREE.MeshPhysicalMaterial({ color: 0x251b16, map: grain, roughness: .28, clearcoat: .7, clearcoatRoughness: .25 });
  // Photographed UV/PBR timber on the case; regional colour tints remain distinct.
  for (const material of [walnut, edge]) {
    // Keep kaya, lacquer and painted cases in their native colour families.
    if (caseColour) {
      material.color.lerp(new THREE.Color(0xffffff), material === walnut ? .72 : .36);
      material.map = caseColour;
    }
    material.bumpMap = null;
    material.normalMap = woodNormal;
    material.normalScale.set(.35, .35);
    material.roughnessMap = woodRoughness;
    material.roughness = .75;
  }
  const brass = new THREE.MeshStandardMaterial({ color: 0xb69757, metalness: .82, roughness: .3 });
  const felt = new THREE.MeshStandardMaterial({ color: japanese ? 0x202521 : 0x142620, roughness: .96 });
  materials.push(walnut, edge, brass, felt);
  function block(size: [number, number, number], position: [number, number, number], material: THREE.Material, radius: number) {
    const geometry = new RoundedBoxGeometry(...size, 3, radius); geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    return mesh;
  }
  if (japanese) {
    // Keep the case below the playable tile tops; coincident faces cause striping.
    block([width+.058,.064,depth+.058], [0,-.032,0], walnut, .003);
    for (const x of [-width*.37,width*.37]) for (const z of [-depth*.37,depth*.37]) block([.036,.027,.036], [x,-.0775,z], walnut, .008);
    for (const compact of [false,true]) for (const stand of shogiStands(width, depth, compact)) {
      const meshes=[
        block([stand.width,.018,stand.depth], [stand.x,-.007,stand.z], walnut, .0025),
        block([.034,.063,.034], [stand.x,-.0475,stand.z], walnut, .004),
        block([compact?.17:.112,.012,compact?.09:.112], [stand.x,-.085,stand.z], walnut, .004)
      ];
      meshes.forEach(mesh=>{mesh.visible=!compact;});handStands.push({compact,meshes});
    }
  } else if (collection === "jungle") {
    // The supporting case ends below the pools; no top plate fills the recesses.
    block([width+.066,.032,depth+.066], [0,-.033,0], edge, .005);
    for (const z of [-depth/2-.015,depth/2+.015]) block([width+.062,.019,.031], [0,-.0045,z], walnut, .002);
    for (const x of [-width/2-.015,width/2+.015]) block([.031,.019,depth+.002], [x,-.0045,0], walnut, .002);
    for (const x of [-width*.436,width*.436]) for (const z of [-depth*.436,depth*.436]) block([.043,.012,.043], [x,-.055,z], edge, .004);
  } else if (collection === "konane") {
    // A solid wooden papamū with actual recessed bowls. The supporting block
    // ends below their bottoms; a full-height top plate would fill the holes.
    block([width+.066,.04,depth+.066], [0,-.029,0], walnut, .005);
    for (const z of [-depth/2-.015,depth/2+.015]) block([width+.062,.018,.031], [0,-.004,z], walnut, .002);
    for (const x of [-width/2-.015,width/2+.015]) block([.031,.018,depth+.002], [x,-.004,0], walnut, .002);
    for (const x of [-width*.436,width*.436]) for (const z of [-depth*.436,depth*.436]) block([.043,.012,.043], [x,-.055,z], edge, .004);
  } else {
    // A thick, bevelled case, a fine brass reveal, and a raised wooden rim.
    block([width+.066,.04,depth+.066], [0,-.029,0], edge, .006);
    block([width+.06,.002,depth+.06], [0,-.008,0], brass, .001);
    block([width+.056,.009,depth+.056], [0,-.003,0], walnut, .002);
    for (const z of [-depth/2-.015,depth/2+.015]) block([width+.056,.009,.027], [0,.001,z], walnut, .002);
    for (const x of [-width/2-.015,width/2+.015]) block([.027,.009,depth+.004], [x,.001,0], walnut, .002);
    for (const x of [-width*.436,width*.436]) for (const z of [-depth*.436,depth*.436]) block([.043,.012,.043], [x,-.055,z], edge, .004);
  }
  // The board actually rests on a table and casts a shadow onto it.
  const tableGeometry = new THREE.PlaneGeometry(8,8); geometries.push(tableGeometry);
  const table = new THREE.Mesh(tableGeometry, felt); table.rotation.x = -Math.PI/2; table.position.y = japanese ? -.091 : -.061; table.receiveShadow = true; group.add(table);
  const ambient = new THREE.HemisphereLight(0xe8e9e2, 0x1b211b, .45); scene.add(ambient);
  const key = new THREE.SpotLight(0xffe4bc, 1.9, 3, Math.PI/5, .65, 2);
  key.position.set(-.38,.85,.25); key.target.position.set(0,0,0);
  key.castShadow = true; key.shadow.mapSize.set(2048,2048); key.shadow.camera.near = .1; key.shadow.camera.far = 2;
  key.shadow.bias = -.00008; key.shadow.normalBias = .0007; key.shadow.radius = 4; key.shadow.blurSamples = 8;
  const rim = new THREE.DirectionalLight(0xbcd7e3, 1.4); rim.position.set(.35,.4,-.5);
  const fill = new THREE.DirectionalLight(0xf6ddb6, .7); fill.position.set(.5,.18,.5);
  scene.add(key, key.target, rim, fill);
  return {
    grain,
    get boardSurface() { return boardSurfaceReady ? boardSurface : null; },
    setBoardSurface(active: boolean) {
      if (!boardSurface) return;
      const useSurface = active && boardSurfaceReady;
      if (useSurface === usingBoardSurface) return;
      usingBoardSurface = useSurface;
      walnut.map = useSurface ? boardSurface : grain;
      walnut.color.set(useSurface ? 0xffffff : 0xc79b57);
      walnut.normalMap = useSurface ? null : woodNormal;
      walnut.bumpMap = useSurface ? boardSurface : null;
      walnut.bumpScale = .000012;
      walnut.roughnessMap = useSurface ? null : woodRoughness;
      walnut.roughness = useSurface ? .58 : .75;
      walnut.clearcoat = useSurface ? .12 : .2;
      walnut.needsUpdate = true;
    },
    setCompactHands(compact:boolean) {handStands.forEach(stand=>stand.meshes.forEach(mesh=>{mesh.visible=stand.compact===compact;}));},
    dispose() {
      disposed = true;
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      woodTextures.forEach(texture => texture.dispose());
      grain.dispose(); environmentMap.dispose(); key.shadow.map?.dispose();
      scene.remove(group, ambient, key, key.target, rim, fill); scene.environment = null;
    }
  };
}
