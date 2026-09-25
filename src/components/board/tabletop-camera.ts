import { Vector3 } from "three";
import { board3DLayout, type PieceCollection } from "./board-3d-config";
import { shogiStands } from "./shogi-stands";

/** Fit the physical case, edge pieces and hand trays with modest breathing room. */
export function tabletopFrame(collection: PieceCollection, rows: number, cols: number, pixels: number, viewportHeight=Infinity) {
  const layout=board3DLayout(collection,rows,cols), narrow=pixels<520;
  const compactHands=narrow&&collection==="shogi";
  // Leave space outside the touch surface so short screens can still scroll.
  const aspect=Math.max(narrow ? compactHands ? .74 : rows>cols ? .86 : .96 : 1.25,pixels/Math.max(160,viewportHeight-96));
  const target=new Vector3(0,-.015,0);
  const direction=new Vector3(narrow?.13:.30,narrow?.76:.58,.76).normalize();
  const right=new Vector3().crossVectors(new Vector3(0,1,0),direction).normalize();
  const up=new Vector3().crossVectors(direction,right);
  const bounds:Vector3[]=[];
  function box(x:number,z:number,width:number,depth:number,bottom:number,top:number) {
    for(const dx of [-width/2,width/2])for(const dz of [-depth/2,depth/2])for(const y of [bottom,top])bounds.push(new Vector3(x+dx,y,z+dz));
  }
  box(0,0,layout.width+.066,layout.depth+.066,collection==="shogi"?-.091:-.061,.006);
  box(0,0,layout.width-.004,layout.depth-.004,.002,collection==="shogi"?.026:.070);
  if(collection==="shogi")for(const stand of shogiStands(layout.width,layout.depth,compactHands))box(stand.x,stand.z,stand.width,stand.depth,-.091,.052);
  const horizontal=Math.tan(21*Math.PI/180),vertical=horizontal/aspect;
  let distance=0;
  for(const point of bounds) {
    const relative=point.clone().sub(target),depth=relative.dot(direction);
    distance=Math.max(distance,depth+Math.abs(relative.dot(right))/(horizontal*.90),depth+Math.abs(relative.dot(up))/(vertical*.90));
  }
  return {aspect,compactHands,target,position:direction.multiplyScalar(distance).add(target),distance,bounds,
    fieldOfView:2*Math.atan(vertical)*180/Math.PI};
}
