import { describe, expect, test } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { tabletopFrame } from "@/components/board/tabletop-camera";
import { tabletopGesture } from "@/components/board/tabletop-gesture";
import { board3DLayout, get3DCollection } from "@/components/board/board-3d-config";
import { shogiHandSlots, shogiStands } from "@/components/board/shogi-stands";
import { variantCatalog } from "@/lib/variants";

function cameraFor(frame:ReturnType<typeof tabletopFrame>) {
  const camera=new PerspectiveCamera(frame.fieldOfView,frame.aspect,.01,10);
  camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld();return camera;
}

describe("responsive physical board framing",()=>{
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
      expect(frame.position.y).toBeGreaterThan(.25);expect(frame.position.z).toBeGreaterThan(frame.position.y);
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
