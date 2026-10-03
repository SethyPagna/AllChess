import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, getLegalMoves, type GameState, type PlayerColor } from "@/lib/variants";
import { restoreJungleOpening } from "@/lib/variants/jungle-profile";
import { createBotSearchStateKey, requestBotMove } from "@/lib/bot/runtime";

function study(legacy=false) {
  let state=createInitialState("jungle");
  if (legacy) state=restoreJungleOpening(state,{...state,variantState:{}});
  state.board.flat().forEach(cell=>{cell.piece=null;});
  return state;
}
function place(state:GameState, row:number,col:number,code:string,owner:PlayerColor) {state.board[row][col].piece={id:`${owner}-${code}-${row}-${col}`,code,owner,labelKey:"chess.pawn"};}
function can(state:GameState,from:number[],to:number[]) {return getLegalMoves(state,{row:from[0],col:from[1]}).some(move=>move.to.row===to[0]&&move.to.col===to[1]);}

describe("versioned Jungle rules",()=>{
  test("bots separate the legacy rule cache and take a legal den win",async()=>{
    const state=study();place(state,1,3,"c","white");place(state,8,6,"e","black");
    const legacy={...state,variantState:{}};
    expect(createBotSearchStateKey(state)).not.toBe(createBotSearchStateKey(legacy));
    const result=await requestBotMove(state,"normal",{engine:"internal",maxSearchTimeMs:80});
    expect(result.move).toMatchObject({from:{row:1,col:3},to:{row:0,col:3}});
    expect(applyMove(state,result.move!)).toMatchObject({status:"completed",result:"white"});
  });
  test("new boards have two rivers, two dens and exactly three adjacent traps per den",()=>{
    const state=createInitialState("jungle");
    expect(state.variantState?.jungleProfile).toBe("standard-v1");
    expect(state.board.flat().filter(c=>c.terrain==="river")).toHaveLength(12);
    expect(state.board.flat().filter(c=>c.terrain==="den")).toHaveLength(2);
    expect(state.board.flat().filter(c=>c.terrain==="trap").map(c=>[c.square.row,c.square.col])).toEqual([[0,2],[0,4],[1,3],[7,3],[8,2],[8,4]]);
  });
  test.each(["white","black"] as const)("%s captures by published rank, including Dog above Wolf",owner=>{
    const codes=["r","c","w","d","p","t","l","e"];
    for(let a=0;a<8;a++)for(let d=0;d<8;d++) {
      const state=study();state.turn=owner;place(state,4,0,codes[a],owner);place(state,3,0,codes[d],owner==="white"?"black":"white");
      expect(can(state,[4,0],[3,0]),`${codes[a]} captures ${codes[d]}`).toBe(a===0&&d===7 ? true : a===7&&d===0 ? false : a>=d);
    }
  });
  test.each(["white","black"] as const)("%s traps weaken enemies, including rats, but protect their owner's rank",owner=>{
    const home=owner==="white"?8:0, near=owner==="white"?7:1,enemy=owner==="white"?"black":"white";
    for(const [target,from] of [[[home,2],[home,1]],[[home,4],[home,5]],[[near,3],[near,2]]]) {
      const state=study();state.turn=owner;place(state,from[0],from[1],"c",owner);place(state,target[0],target[1],"e",enemy);
      expect(can(state,from,target)).toBe(true);
      place(state,from[0],from[1],"e",owner);place(state,target[0],target[1],"r",enemy);expect(can(state,from,target)).toBe(true);
      place(state,from[0],from[1],"c",enemy);place(state,target[0],target[1],"e",owner);state.turn=enemy;expect(can(state,from,target)).toBe(false);
    }
  });
  test("rats cannot capture across either river boundary, but can capture in water",()=>{
    for(const [from,to] of [[[2,1],[3,1]],[[3,1],[2,1]]]) {
      const state=study();place(state,from[0],from[1],"r","white");place(state,to[0],to[1],"r","black");expect(can(state,from,to)).toBe(false);
    }
    const state=study();place(state,3,1,"r","white");place(state,3,2,"r","black");expect(can(state,[3,1],[3,2])).toBe(true);
  });
  test.each(["l","t"])("%s jumps either direction, lands captures, and stops for either side's rat",code=>{
    for(const [from,to,block] of [[[6,1],[2,1],[4,1]],[[4,0],[4,3],[4,2]]]) {
      const state=study();place(state,from[0],from[1],code,"white");place(state,to[0],to[1],"c","black");expect(can(state,from,to)).toBe(true);
      for(const owner of ["white","black"] as const){place(state,block[0],block[1],"r",owner);expect(can(state,from,to)).toBe(false);}
    }
  });
  test("old profiles preserve their terrain, reversed trap semantics and water captures",()=>{
    const state=study(true);expect(state.board.flat().filter(c=>c.terrain==="trap")).toHaveLength(10);
    place(state,1,1,"c","white");place(state,1,2,"e","black");expect(can(state,[1,1],[1,2])).toBe(true);
    place(state,3,1,"r","white");place(state,2,1,"r","black");expect(can(state,[3,1],[2,1])).toBe(true);
    const start=createInitialState("jungle");const restored=restoreJungleOpening(start,state);expect(restored.variantState?.jungleProfile).toBeUndefined();expect(start.variantState?.jungleProfile).toBe("standard-v1");
  });
  test("immobilization draws new games instead of leaving the player stuck",()=>{
    for(const legacy of [false,true]) {
      const state=study(legacy);place(state,0,0,"e","black");place(state,0,1,"r","white");place(state,1,0,"r","white");place(state,8,0,"c","white");
      const next=applyMove(state,{from:{row:8,col:0},to:{row:7,col:0}});
      expect(next.status).toBe(legacy?"active":"completed");if(!legacy)expect(next).toMatchObject({result:"draw",outcomeReason:"stalemate"});
    }
  });
});
