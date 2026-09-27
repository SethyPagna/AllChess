import { Vector3, type PerspectiveCamera } from "three";
import { board3DLayout, type PieceCollection } from "./board-3d-config";
import { shogiStands } from "./shogi-stands";

// Highest delivered mesh plus its board placement and a small safety margin.
// Draughts includes all three sets; papamū stones sit inside recessed wells.
export const tabletopPieceTop: Record<PieceCollection, number> = {
  classic: .072, khmer: .078, shogi: .016, xiangqi: .016, janggi: .018,
  makruk: .071, draughts: .026, konane: .014, chaturanga: .056, shatranj: .053, jungle: .055
};

/** Fit the physical case, edge pieces and hand trays with modest breathing room. */
export function tabletopFrame(collection: PieceCollection, rows: number, cols: number, pixels: number, viewportHeight=Infinity) {
  const layout=board3DLayout(collection,rows,cols), narrow=pixels<520;
  const compactHands=narrow&&collection==="shogi";
  const target=new Vector3(0,-.015,0);
  const direction=new Vector3(narrow?.13:.30,narrow?.76:.58,.76).normalize();
  const bounds:Vector3[]=[];
  function box(x:number,z:number,width:number,depth:number,bottom:number,top:number) {
    for(const dx of [-width/2,width/2])for(const dz of [-depth/2,depth/2])for(const y of [bottom,top])bounds.push(new Vector3(x+dx,y,z+dz));
  }
  box(0,0,layout.width+.066,layout.depth+.066,collection==="shogi"?-.091:-.061,.006);
  box(0,0,layout.width-.004,layout.depth-.004,.002,tabletopPieceTop[collection]);
  // A captured hand displays up to three tiles, with the selected top tile
  // lifted 4 mm. Keep that full stack inside the fixed composition envelope.
  const handTop=tabletopPieceTop.shogi+2*.012+.004;
  if(collection==="shogi")for(const stand of shogiStands(layout.width,layout.depth,compactHands))box(stand.x,stand.z,stand.width,stand.depth,-.091,handTop);
  // Size the stage for this physical composition, then keep it fixed while
  // orbiting. Short screens still retain space outside the touch surface.
  const aspect=Math.max(compositionAspect(bounds,direction,target),pixels/Math.max(160,viewportHeight-96));
  const fitted=fitTabletopBounds(bounds,direction,aspect,target);
  // A bounding sphere provides a safe distance at every allowed orbit angle,
  // including Shogi's wide trays when they rotate into the vertical axis.
  const radius=Math.max(...bounds.map(point=>point.distanceTo(target)));
  const limitingSlope=Math.tan(21*Math.PI/180)*.90/Math.max(1,aspect);
  const maxDistance=Math.max(fitted.distance*1.65,radius/Math.sin(Math.atan(limitingSlope)));
  return {aspect,compactHands,bounds,maxDistance,...fitted};
}

function compositionAspect(bounds:Vector3[],direction:Vector3,target:Vector3) {
  const right=new Vector3().crossVectors(new Vector3(0,1,0),direction).normalize();
  const up=new Vector3().crossVectors(direction,right);
  const points=bounds.map(point=>{const relative=point.clone().sub(target);return {x:relative.dot(right),y:relative.dot(up),depth:relative.dot(direction)};});
  const slope=Math.tan(21*Math.PI/180)*.90;
  const distance=(Math.max(...points.map(p=>p.x+slope*p.depth))-Math.min(...points.map(p=>p.x-slope*p.depth)))/(2*slope);
  // At the width-fitting distance, every pair of vertical intervals must
  // overlap. Their tightest constraint gives the matching vertical field.
  let verticalSlope=0;
  for(const a of points)for(const b of points)verticalSlope=Math.max(verticalSlope,(a.y-b.y)/(2*distance-a.depth-b.depth));
  return slope/verticalSlope;
}

/** Small edge annotations retain their cap height through perspective and orbit. */
export function tabletopCoordinateHeight(position:Vector3,camera:PerspectiveCamera,pixels:number) {
  const depth=-position.clone().applyMatrix4(camera.matrixWorldInverse).z;
  return (pixels<520?8:10)*2*depth*Math.tan(camera.fov*Math.PI/360)*camera.aspect/Math.max(1,pixels);
}

export function tabletopCoordinateFrame(anchor:Vector3,camera:PerspectiveCamera,pixels:number,glyphHeight=1) {
  const position=anchor.clone(),height=tabletopCoordinateHeight(anchor,camera,pixels);
  const towardCamera=camera.position.clone().sub(anchor).normalize();
  const cameraUp=new Vector3().setFromMatrixColumn(camera.matrixWorld,1);
  // Move only along the viewing ray: the screen anchor stays on its rail.
  // Clearing the rail keeps the whole upright glyph visible with depth testing.
  const halfRise=height*glyphHeight*Math.abs(cameraUp.y)/2;
  const lift=(halfRise+.001)/Math.max(.001,towardCamera.y+halfRise/camera.position.distanceTo(anchor));
  position.addScaledVector(towardCamera,lift);
  return {position,height:tabletopCoordinateHeight(position,camera,pixels)};
}

/** Recompose the automatic orbit without clipping corners as the angle changes. */
export function fitTabletopBounds(bounds:Vector3[], direction:Vector3, aspect:number, target=new Vector3(0,-.015,0)) {
  direction=direction.clone().normalize();target=target.clone();
  const right=new Vector3().crossVectors(new Vector3(0,1,0),direction).normalize();
  const up=new Vector3().crossVectors(direction,right);
  const horizontal=Math.tan(21*Math.PI/180),vertical=horizontal/aspect;
  // Fit both sides of each screen axis. A fixed world-centred target leaves the
  // near corner filling one edge while wasting space at the opposite edge.
  // These intervals account for each corner's perspective depth, not an
  // orthographic bounding rectangle or a guessed camera offset.
  const projected=bounds.map(point=>{
    const relative=point.clone().sub(target);
    return {x:relative.dot(right),y:relative.dot(up),depth:relative.dot(direction)};
  });
  function fitAxis(axis:"x"|"y",slope:number) {
    const high=Math.max(...projected.map(point=>point[axis]+slope*point.depth));
    const low=Math.min(...projected.map(point=>point[axis]-slope*point.depth));
    return {distance:(high-low)/(2*slope),offset:(high+low)/2};
  }
  const x=fitAxis("x",horizontal*.90),y=fitAxis("y",vertical*.90);
  const distance=Math.max(x.distance,y.distance);
  target.addScaledVector(right,x.offset).addScaledVector(up,y.offset);
  return {target,position:direction.multiplyScalar(distance).add(target),distance,
    fieldOfView:2*Math.atan(vertical)*180/Math.PI};
}
