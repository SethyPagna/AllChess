import { expect, test } from "vitest";
import { transitionFriendRoom } from "@/lib/realtime/friend-room";
import { applyMove, createInitialState } from "@/lib/variants";
import { restoreJungleOpening } from "@/lib/variants/jungle-profile";
const host="11111111-1111-4111-8111-111111111111",guest="22222222-2222-4222-8222-222222222222";
test("Jungle room moves, rejoining and replay retain the six-trap profile",async()=>{
  const created=await transitionFriendRoom(null,"jungle-room",{action:"create",token:host,variantKey:"jungle",time:"freestyle",side:"first"},1000);
  let room=(await transitionFriendRoom(created.stored,"jungle-room",{action:"join",token:guest},2000)).stored!;
  for(const [token,from,to] of [[host,[6,6],[5,6]],[guest,[2,0],[3,0]],[host,[5,6],[5,5]],[guest,[3,0],[3,1]]] as const) {
    const result=await transitionFriendRoom(room,"jungle-room",{action:"move",token,gameId:room.state.id,version:room.state.ply,move:{from:{row:from[0],col:from[1]},to:{row:to[0],col:to[1]}}},2000);
    expect(result.status).toBe(200);room=result.stored!;
  }
  const returned=await transitionFriendRoom(room,"jungle-room",{action:"join",token:guest},3000);
  expect(returned.body.room?.state.variantState?.jungleProfile).toBe("standard-v1");
  let replay=restoreJungleOpening(createInitialState("jungle"),room.state);
  for(const move of room.state.moves)replay=applyMove(replay,move);
  expect(replay.board).toEqual(room.state.board);
  expect(room.state.board.flat().filter(cell=>cell.terrain==="trap")).toHaveLength(6);
});
test("room authority rejects rat captures across a bank without committing a version",async()=>{
  const created=await transitionFriendRoom(null,"jungle-room",{action:"create",token:host,variantKey:"jungle",time:"freestyle",side:"first"},1000);
  const room=(await transitionFriendRoom(created.stored,"jungle-room",{action:"join",token:guest},2000)).stored!;
  room.state.board.flat().forEach(cell=>{cell.piece=null;});
  for(const [row,owner] of [[2,"white"],[3,"black"]] as const)room.state.board[row][1].piece={id:owner,code:"r",owner,labelKey:"chess.pawn"};
  const rejected=await transitionFriendRoom(room,"jungle-room",{action:"move",token:host,gameId:room.state.id,version:0,move:{from:{row:2,col:1},to:{row:3,col:1}}},2000);
  expect(rejected.status).toBe(400);expect(room.state.ply).toBe(0);expect(room.state.captured).toHaveLength(0);
});
