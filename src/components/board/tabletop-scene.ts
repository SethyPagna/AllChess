import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

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

export function createTabletopScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const grain = woodGrain();
  grain.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const environment = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const environmentMap = generator.fromScene(environment, .04);
  scene.environment = environmentMap.texture; scene.environmentIntensity = .45;
  environment.dispose(); generator.dispose();
  scene.background = new THREE.Color(0x171b1a);
  scene.fog = new THREE.Fog(0x171b1a, 1.8, 4);
  const group = new THREE.Group(); scene.add(group);
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [];
  const walnut = new THREE.MeshPhysicalMaterial({ color: 0x493022, map: grain, bumpMap: grain, bumpScale: .00015, roughness: .32, clearcoat: .6, clearcoatRoughness: .28 });
  const edge = new THREE.MeshPhysicalMaterial({ color: 0x251b16, map: grain, roughness: .28, clearcoat: .7, clearcoatRoughness: .25 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb69757, metalness: .82, roughness: .3 });
  const felt = new THREE.MeshStandardMaterial({ color: 0x142620, roughness: .96 });
  materials.push(walnut, edge, brass, felt);
  function block(size: [number, number, number], position: [number, number, number], material: THREE.Material, radius: number) {
    const geometry = new RoundedBoxGeometry(...size, 3, radius); geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    return mesh;
  }
  // A thick, bevelled case, a fine brass reveal, and a raised wooden rim.
  block([.49,.04,.49], [0,-.029,0], edge, .006);
  block([.484,.002,.484], [0,-.008,0], brass, .001);
  block([.48,.009,.48], [0,-.003,0], walnut, .002);
  for (const z of [-.227,.227]) block([.48,.009,.027], [0,.001,z], walnut, .002);
  for (const x of [-.227,.227]) block([.027,.009,.428], [x,.001,0], walnut, .002);
  for (const x of [-.185,.185]) for (const z of [-.185,.185]) block([.043,.012,.043], [x,-.055,z], edge, .004);
  // The board actually rests on a table and casts a shadow onto it.
  const tableGeometry = new THREE.PlaneGeometry(8,8); geometries.push(tableGeometry);
  const table = new THREE.Mesh(tableGeometry, felt); table.rotation.x = -Math.PI/2; table.position.y = -.061; table.receiveShadow = true; group.add(table);
  const ambient = new THREE.HemisphereLight(0xe8e9e2, 0x1b211b, .45); scene.add(ambient);
  const key = new THREE.SpotLight(0xffe4bc, 3.2, 3, Math.PI/5, .65, 2);
  key.position.set(-.38,.85,.25); key.target.position.set(0,0,0);
  key.castShadow = true; key.shadow.mapSize.set(2048,2048); key.shadow.camera.near = .1; key.shadow.camera.far = 2;
  key.shadow.bias = -.00008; key.shadow.normalBias = .0007; key.shadow.radius = 4; key.shadow.blurSamples = 8;
  const rim = new THREE.DirectionalLight(0xbcd7e3, 1.2); rim.position.set(.35,.4,-.5);
  const fill = new THREE.DirectionalLight(0xf6ddb6, .5); fill.position.set(.5,.18,.5);
  scene.add(key, key.target, rim, fill);
  return {
    grain,
    dispose() {
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      grain.dispose(); environmentMap.dispose(); key.shadow.map?.dispose();
      scene.remove(group, ambient, key, key.target, rim, fill); scene.environment = null;
    }
  };
}
