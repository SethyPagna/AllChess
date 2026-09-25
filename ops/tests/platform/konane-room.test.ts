import { expect, test } from "vitest";
import { transitionFriendRoom } from "@/lib/realtime/friend-room";
import { createInitialState, applyMove } from "@/lib/variants";
import { restoreKonaneOpening } from "@/lib/variants/konane-profile";

const host="11111111-1111-4111-8111-111111111111", guest="22222222-2222-4222-8222-222222222222";
test("Kōnane rooms start Black, validate both removals, and preserve the profile on rejoin and replay", async()=>{
  const created=await transitionFriendRoom(null,"konane-room",{action:"create",token:host,variantKey:"konane",time:"freestyle",side:"first"},1000);
  let room=(await transitionFriendRoom(created.stored,"konane-room",{action:"join",token:guest},2000)).stored!;
  expect(room.state.turn).toBe("black");
  const first={kind:"remove" as const,from:{row:0,col:0},to:{row:0,col:0}};
  expect((await transitionFriendRoom(room,"konane-room",{action:"move",token:host,gameId:room.state.id,version:0,move:first},2000)).status).toBe(403);
  const black=await transitionFriendRoom(room,"konane-room",{action:"move",token:guest,gameId:room.state.id,version:0,move:first},2000);
  expect(black.status).toBe(200); room=black.stored!;
  const white=await transitionFriendRoom(room,"konane-room",{action:"move",token:host,gameId:room.state.id,version:1,move:{kind:"remove",from:{row:7,col:0},to:{row:7,col:0}}},2000);
  expect(white.status).toBe(200); room=white.stored!;
  const jumped=await transitionFriendRoom(room,"konane-room",{action:"move",token:guest,gameId:room.state.id,version:2,move:{from:{row:2,col:0},to:{row:0,col:0}}},2000);
  expect(jumped.status).toBe(200); room=jumped.stored!;
  const returned=await transitionFriendRoom(room,"konane-room",{action:"join",token:guest},3000);
  expect(returned.body.room?.state.variantState?.konaneProfile).toBe("nps-v1");
  let replay=restoreKonaneOpening(createInitialState("konane"),room.state);
  for (const move of room.state.moves) replay=applyMove(replay,move);
  expect(replay.board).toEqual(room.state.board); expect(replay.turn).toBe(room.state.turn);
});

test("a longer Kōnane room move captures all intermediate stones and commits one version", async()=>{
  const created=await transitionFriendRoom(null,"konane-room",{action:"create",token:host,variantKey:"konane",time:"freestyle",side:"second"},1000);
  const room=(await transitionFriendRoom(created.stored,"konane-room",{action:"join",token:guest},2000)).stored!;
  room.state.board.flat().forEach(cell=>{cell.piece=null;});
  room.state.variantState={...room.state.variantState,konaneOpening:{removals:2}};
  for (const [col,owner] of [[0,"black"],[1,"white"],[3,"white"],[5,"white"]] as const) room.state.board[4][col].piece={id:`stone-${col}`,owner,code:"p",labelKey:"chess.pawn"};
  const result=await transitionFriendRoom(room,"konane-room",{action:"move",token:host,gameId:room.state.id,version:0,move:{from:{row:4,col:0},to:{row:4,col:6}}},2000);
  expect(result.status).toBe(200); expect(result.stored!.state.ply).toBe(1);
  expect(result.stored!.state.captured).toHaveLength(3);
  expect(result.stored!.state).toMatchObject({status:"completed",result:"black"});
});
