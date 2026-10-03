import * as THREE from "three";
import type { BoardCell } from "@/lib/variants";

export const jungleLandTop = .002;
export const jungleWaterTop = -.006;

/** Recessed enamel pools and inset den/trap emblems, all actual geometry. */
export function createJungleTerrainKit(pitch: number) {
  const land = new THREE.BoxGeometry(pitch - .0006, .016, pitch - .0006);
  land.translate(0, -.006, 0);
  const water = new THREE.BoxGeometry(pitch - .0006, .008, pitch - .0006);
  water.translate(0, -.010, 0);
  const ring = new THREE.TorusGeometry(.017, .001, 6, 40);
  const center = new THREE.CircleGeometry(.016, 40);
  const bar = new THREE.BoxGeometry(.027, .0008, .0013);
  const wave = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.013, 0, 0), new THREE.Vector3(-.006, 0, .0014),
    new THREE.Vector3(.006, 0, -.0014), new THREE.Vector3(.013, 0, 0)
  ]), 12, .00025, 3, false);
  const brass = new THREE.MeshStandardMaterial({color:0xbf9c55,metalness:.72,roughness:.35});
  const den = new THREE.MeshStandardMaterial({color:0x123a30,roughness:.65});
  const ripple = new THREE.MeshStandardMaterial({color:0x7db3b5,roughness:.25,metalness:.25});
  return {
    land, water,
    decorate(cell: BoardCell) {
      const group = new THREE.Group();
      const emblem = (geometry: THREE.BufferGeometry, material: THREE.Material) => {const mesh=new THREE.Mesh(geometry,material); group.add(mesh); return mesh;};
      if (cell.terrain === "river") {
        for (const z of [-.009,0,.009]) emblem(wave,ripple).position.set(0,jungleWaterTop+.0004,z);
      } else if (cell.terrain === "den") {
        const disc=emblem(center,den); disc.rotation.x=-Math.PI/2; disc.position.y=.0022;
        const rim=emblem(ring,brass); rim.rotation.x=-Math.PI/2; rim.position.y=.0026;
      } else if (cell.terrain === "trap") {
        for (const angle of [-Math.PI/4,Math.PI/4]) {const mark=emblem(bar,brass);mark.rotation.y=angle;mark.position.y=.0025;}
      }
      group.traverse(child=>{child.userData.square=cell.square;});
      return group;
    },
    dispose() { [land,water,ring,center,bar,wave].forEach(g=>g.dispose()); [brass,den,ripple].forEach(m=>m.dispose()); }
  };
}
