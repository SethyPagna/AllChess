import { describe, expect, test } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { fitTabletopBounds, tabletopCoordinateFrame, tabletopFrame, tabletopPieceTop } from "@/components/board/tabletop-camera";
import { tabletopGesture } from "@/components/board/tabletop-gesture";
import { board3DLayout, get3DCollection } from "@/components/board/board-3d-config";
import { shogiHandSlots, shogiStands, shogiStandTop } from "@/components/board/shogi-stands";
import { variantCatalog } from "@/lib/variants";

function cameraFor(frame:ReturnType<typeof tabletopFrame>) {
  const camera=new PerspectiveCamera(frame.fieldOfView,frame.aspect,.01,10);
  camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld();return camera;
}

describe("responsive physical board framing",()=>{
  test.each(variantCatalog.map(variant=>variant.key))("%s stays framed throughout an automatic orbit",key=>{
    const variant=variantCatalog.find(v=>v.key===key)!,collection=get3DCollection(key)!;
    for(const width of [296,692])for(const polar of [.45,.8,Math.PI/2.35])for(const azimuth of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5]) {
      const frame=tabletopFrame(collection,variant.board.rows,variant.board.cols,width);
      const direction=new Vector3().setFromSphericalCoords(1,polar,azimuth);
      const fitted=fitTabletopBounds(frame.bounds,direction,frame.aspect);
      const camera=cameraFor({...frame,...fitted});
      expect(fitted.distance).toBeLessThanOrEqual(frame.maxDistance);
      for(const corner of frame.bounds){const p=corner.clone().project(camera);expect(Math.max(Math.abs(p.x),Math.abs(p.y))).toBeLessThanOrEqual(.900001);}
    }
  });
  test.each(variantCatalog.map(variant=>variant.key))("%s keeps the full case, edge pieces and hands inside desktop and phone views",key=>{
    const variant=variantCatalog.find(v=>v.key===key)!,collection=get3DCollection(key)!;
    for(const width of [288,358,480,520,900]) {
      const frame=tabletopFrame(collection,variant.board.rows,variant.board.cols,width),camera=cameraFor(frame);
      for(const corner of frame.bounds) {
        const projected=corner.clone().project(camera);
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(.900001);
        expect(Math.abs(projected.y)).toBeLessThanOrEqual(.900001);
        expect(projected.z).toBeGreaterThan(-1);expect(projected.z).toBeLessThan(1);
      }
      const points=frame.bounds.map(corner=>corner.clone().project(camera));
      for(const axis of ["x","y"] as const) {
        const low=Math.min(...points.map(point=>point[axis])),high=Math.max(...points.map(point=>point[axis]));
        expect(Math.abs(high+low), `${key} ${width}px ${axis} framing imbalance`).toBeLessThan(.12);
        expect(high-low, `${key} ${width}px ${axis} stage occupancy`).toBeGreaterThan(1.79);
      }
      expect(frame.position.y).toBeGreaterThan(.25);expect(frame.position.z).toBeGreaterThan(frame.position.y);
    }
  });
  test.each(["english-draughts","international-draughts","xiangqi","janggi","konane"])("%s uses its actual shallow pieces and a compact phone stage",key=>{
    const variant=variantCatalog.find(v=>v.key===key)!,collection=get3DCollection(key)!;
    const frame=tabletopFrame(collection,variant.board.rows,variant.board.cols,296);
    expect(tabletopPieceTop[collection]).toBeLessThan(.027);
    expect(296/frame.aspect).toBeLessThan(230);
  });
  test.each(variantCatalog.map(variant=>variant.key))("%s coordinates retain small readable glyphs on their rail anchors",key=>{
    const variant=variantCatalog.find(v=>v.key===key)!,collection=get3DCollection(key)!,layout=board3DLayout(collection,variant.board.rows,variant.board.cols);
    for(const width of [296,366,692]) {
      const frame=tabletopFrame(collection,variant.board.rows,variant.board.cols,width);
      const positions=collection==="shogi"
        ? [new Vector3(0,.006,-layout.edgeZ),new Vector3(layout.edgeX,.006,0)]
        : [new Vector3(0,.006,layout.edgeZ),new Vector3(-layout.edgeX,.006,0)];
      for(const azimuth of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const polar of [.45,Math.PI/2.35]) {
        const fitted=fitTabletopBounds(frame.bounds,new Vector3().setFromSphericalCoords(1,polar,azimuth),frame.aspect);
        const camera=cameraFor({...frame,...fitted}),up=new Vector3().setFromMatrixColumn(camera.matrixWorld,1);
        for(const anchor of positions) {
          const {position,height}=tabletopCoordinateFrame(anchor,camera,width,1.4);
          const projected=position.clone().project(camera),original=anchor.clone().project(camera);
          expect(projected.x).toBeCloseTo(original.x,8);expect(projected.y).toBeCloseTo(original.y,8);
          const a=position.clone().addScaledVector(up,-height/2).project(camera),b=position.clone().addScaledVector(up,height/2).project(camera);
          const renderedPixels=Math.hypot((a.x-b.x)*width/2,(a.y-b.y)*width/(2*frame.aspect));
          expect(renderedPixels).toBeCloseTo(width<520?8:10,6);
          expect(position.y-height*1.4*up.y/2).toBeGreaterThan(anchor.y);
          expect(Math.max(Math.abs(projected.x),Math.abs(projected.y))+14/width).toBeLessThan(1);
        }
      }
    }
  });
  test.each(["shogi","mini-shogi"])("%s can rotate its trays ninety degrees without the distance limit clamping its fit",key=>{
    const variant=variantCatalog.find(v=>v.key===key)!;
    for(const width of [296,366,692]) {
      const frame=tabletopFrame("shogi",variant.board.rows,variant.board.cols,width);
      for(const polar of [.45,.8,Math.PI/2.35])for(const azimuth of [Math.PI/2,Math.PI*1.5]) {
        const fitted=fitTabletopBounds(frame.bounds,new Vector3().setFromSphericalCoords(1,polar,azimuth),frame.aspect);
        expect(fitted.distance).toBeLessThan(frame.maxDistance);
        const camera=cameraFor({...frame,...fitted});
        for(const corner of frame.bounds){const point=corner.clone().project(camera);expect(Math.max(Math.abs(point.x),Math.abs(point.y))).toBeLessThanOrEqual(.900001);}
      }
    }
  });
  test.each([5,9])("compact %s-square Shogi trays clear the case and retain every captured type through rotation",size=>{
    const layout=board3DLayout("shogi",size,size);
    const hands={sente:{r:2,b:2,g:4,s:4,n:4,l:4,p:18},gote:{r:1,p:1}};
    const normal=shogiHandSlots(layout.width,layout.depth,hands,false,true),flipped=shogiHandSlots(layout.width,layout.depth,hands,true,true);
    expect(normal).toHaveLength(9);
    for(const stand of shogiStands(layout.width,layout.depth,true))expect(Math.abs(stand.z)-stand.depth/2).toBeGreaterThan(layout.depth/2+.033);
    for(const slot of normal) {
      const stand=shogiStands(layout.width,layout.depth,true).find(s=>s.near===slot.near)!;
      expect(Math.abs(slot.x-stand.x)+.025).toBeLessThan(stand.width/2);
      expect(Math.abs(slot.z-stand.z)+.025).toBeLessThan(stand.depth/2);
      const reverse=flipped.find(s=>s.owner===slot.owner&&s.code===slot.code)!;
      expect(reverse.x).toBeCloseTo(-slot.x);expect(reverse.z).toBeCloseTo(-slot.z);expect(reverse.count).toBe(slot.count);
    }
  });
  test.each([5,9])("%s-square Shogi frames selected three-tile hands on both trays through a full orbit",size=>{
    const layout=board3DLayout("shogi",size,size);
    const hands={sente:{r:3,b:3,g:3,s:3,n:3,l:3,p:18},gote:{r:3,b:3,g:3,s:3,n:3,l:3,p:18}};
    // Include a conservative 14 mm native tile, the third stack tier, and
    // the 4 mm selection lift used by Board3D, independently of frame.bounds.
    const selectedTop=shogiStandTop+2*.012+.004+.014;
    for(const width of [296,366,692]) {
      const frame=tabletopFrame("shogi",size,size,width);
      expect(Math.max(...frame.bounds.map(point=>point.y))+1e-9).toBeGreaterThanOrEqual(selectedTop);
      const slots=shogiHandSlots(layout.width,layout.depth,hands,false,frame.compactHands);
      for(const polar of [.45,.8,Math.PI/2.35])for(const azimuth of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
        const fitted=fitTabletopBounds(frame.bounds,new Vector3().setFromSphericalCoords(1,polar,azimuth),frame.aspect);
        expect(fitted.distance).toBeLessThan(frame.maxDistance);
        const camera=cameraFor({...frame,...fitted});
        for(const slot of slots)for(const dx of [-.025,.025])for(const dz of [-.025,.025]) {
          const projected=new Vector3(slot.x+dx,selectedTop,slot.z+dz).project(camera);
          expect(Math.max(Math.abs(projected.x),Math.abs(projected.y))).toBeLessThanOrEqual(.900001);
        }
      }
    }
  });
  test.each(["classic","shogi","jungle"])("%s fits short landscape screens without trapping page scrolling",key=>{
    const variant=variantCatalog.find(v=>v.key===key)!,collection=get3DCollection(key)!;
    for(const width of [296,700])for(const height of [320,390,600]) {
      const frame=tabletopFrame(collection,variant.board.rows,variant.board.cols,width,height),camera=cameraFor(frame);
      expect(width/frame.aspect).toBeLessThanOrEqual(height-96);
      for(const corner of frame.bounds){const p=corner.clone().project(camera);expect(Math.max(Math.abs(p.x),Math.abs(p.y))).toBeLessThanOrEqual(.900001);}
    }
  });
  test.each(["classic","jungle","shogi","mini-shogi"])("%s occupies more phone pixels than the previous fixed landscape camera",key=>{
    const variant=variantCatalog.find(v=>v.key===key)!,collection=get3DCollection(key)!,layout=board3DLayout(collection,variant.board.rows,variant.board.cols);
    const frame=tabletopFrame(collection,variant.board.rows,variant.board.cols,288),camera=cameraFor(frame);
    const old=new PerspectiveCamera(2*Math.atan(Math.tan(21*Math.PI/180)/1.25)*180/Math.PI,1.25,.01,10);
    old.position.set(.3,.56,.76).multiplyScalar(layout.cameraScale);old.lookAt(0,-.02,0);old.updateMatrixWorld();
    const area=(view:PerspectiveCamera,aspect:number)=>{
      const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>new Vector3(x*layout.width/2,.002,z*layout.depth/2).project(view));
      return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%4];return sum+p.x*q.y-q.x*p.y;},0))/aspect;
    };
    expect(area(camera,frame.aspect)/area(old,1.25)).toBeGreaterThan(1.2);
  });
});

describe("camera gestures cannot become moves",()=>{
  test("a drag that returns to its starting pixel stays a gesture",()=>{
    const gesture=tabletopGesture();gesture.down(1,100,100);gesture.move(1,160,130);gesture.move(1,100,100);expect(gesture.up(1,100,100)).toBe(false);
    gesture.down(1,100,100);expect(gesture.up(1,102,101)).toBe(true);
  });
  test("pinches, canceled pointers and secondary releases never tap",()=>{
    const gesture=tabletopGesture();gesture.down(1,100,100);gesture.down(2,130,100);
    expect(gesture.up(1,100,100)).toBe(false);expect(gesture.up(2,130,100)).toBe(false);
    gesture.down(3,10,10);gesture.cancel(3);expect(gesture.up(3,10,10)).toBe(false);expect(gesture.up(9,10,10)).toBe(false);
  });
});
