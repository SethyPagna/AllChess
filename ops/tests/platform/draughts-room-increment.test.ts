import { expect, test } from "vitest";
import { transitionFriendRoom } from "@/lib/realtime/friend-room";

const host = "11111111-1111-4111-8111-111111111111", guest = "22222222-2222-4222-8222-222222222222";
const paths = {
  "english-draughts": { hops: [[7, 2], [5, 4], [3, 6]], victims: [[6, 3], [4, 5]] },
  "international-draughts": { hops: [[9, 2], [7, 4], [5, 6]], victims: [[8, 3], [6, 5]] }
} as const;

test.each(Object.keys(paths) as Array<keyof typeof paths>)("a Classical %s room credits one increment for a two-piece capture", async variantKey => {
  const created = await transitionFriendRoom(null, "draughts-clock", { action: "create", token: host, variantKey, time: "classical", side: "first" }, 0);
  let room = (await transitionFriendRoom(created.stored, "draughts-clock", { action: "join", token: guest }, 0)).stored!;
  const { hops, victims } = paths[variantKey];
  room.state.board.forEach(row => row.forEach(cell => { cell.piece = null; }));
  const put = ([row, col]: readonly [number, number], owner: "white" | "black") => { room.state.board[row][col].piece = { id: `${owner}-${row}-${col}`, code: "p", owner, labelKey: "draughts.man" }; };
  put(hops[0], "white");
  victims.forEach(victim => put(victim, "black"));
  put([0, 1], "black");
  expect(room.state.turn).toBe("white");
  const white = () => room.state.clocks.find(clock => clock.color === "white")!;
  const { remainingMs: startMs, incrementMs } = white();
  expect(incrementMs).toBe(20_000);

  for (let hop = 1; hop < hops.length; hop++) {
    const [fromRow, fromCol] = hops[hop - 1], [toRow, toCol] = hops[hop];
    const move = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
    const result = await transitionFriendRoom(room, "draughts-clock", { action: "move", token: host, gameId: room.state.id, version: room.state.ply, move }, hop * 1000);
    expect(result.status).toBe(200);
    room = result.stored!;
    expect(room.state.turn).toBe(hop < hops.length - 1 ? "white" : "black");
    expect(white().remainingMs).toBe(startMs - hop * 1000 + (hop < hops.length - 1 ? 0 : incrementMs));
  }
});
