import { BufferGeometry, Float32BufferAttribute } from "three";

/** A continuous square of timber with a carved bowl, in metres. No painted pits. */
export function createKonaneCellGeometry(pitch = .053) {
  const segments = 64, positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const profile = [[0, -.006], [.008, -.005], [.013, -.003], [.017, -.0005], [.0195, .0015], [.021, .002], [0, .002]];
  for (let ring = 0; ring < profile.length; ring++) for (let i = 0; i < segments; i++) {
    const angle = i*Math.PI*2/segments, cos = Math.cos(angle), sin = Math.sin(angle);
    const radius = ring === profile.length-1 ? pitch/2/Math.max(Math.abs(cos), Math.abs(sin)) : profile[ring][0];
    const x = radius*cos, z = radius*sin;
    positions.push(x, profile[ring][1], z); uv.push(x/pitch+.5, z/pitch+.5);
  }
  for (let ring = 0; ring < profile.length-1; ring++) for (let i = 0; i < segments; i++) {
    const a = ring*segments+i, b = ring*segments+(i+1)%segments, c = a+segments, d = b+segments;
    if (ring) indices.push(a,b,c);
    indices.push(b,d,c);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions,3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv,2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
