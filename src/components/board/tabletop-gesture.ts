/** A drag remains a gesture even if it ends back where it started. */
export function tabletopGesture() {
  const pointers=new Map<number,{x:number;y:number}>();
  let moved=false;
  return {
    down(id:number,x:number,y:number) {
      if(!pointers.size)moved=false;
      pointers.set(id,{x,y});if(pointers.size>1)moved=true;
    },
    move(id:number,x:number,y:number) {
      const start=pointers.get(id);if(start&&Math.hypot(x-start.x,y-start.y)>5)moved=true;
    },
    up(id:number,x:number,y:number) {
      const start=pointers.get(id);pointers.delete(id);
      return Boolean(start&&!moved&&Math.hypot(x-start.x,y-start.y)<=5);
    },
    cancel(id:number) {pointers.delete(id);moved=true;}
  };
}
