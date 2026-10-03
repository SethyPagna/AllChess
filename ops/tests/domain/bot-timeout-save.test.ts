import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, getLegalMoves, variantCatalog, type GameState, type Move } from "@/lib/variants";
import { getCatalogModeSupport, getGameCatalogEntry } from "@/lib/catalog";
import { botDifficultyLevels } from "@/lib/bot/config";
import { applyBotMoveAfterThinking, botReplyHistoryFrame, withoutFlaggedBotFrame } from "@/lib/game/bot-clock";
import { tickGameClock } from "@/lib/game/clocks";
import { undoTimeline } from "@/lib/game/history";
import { decodeLocalMatch, encodeLocalMatch, type LocalMatchRecord, type LocalMatchSnapshot } from "@/lib/game/local-match";
import { exportLocalMatch, importLocalMatch } from "@/lib/game/local-match-transfer";

const botVariants = variantCatalog.map(variant => variant.key).filter(key => {
  const entry = getGameCatalogEntry(key);
  return entry && getCatalogModeSupport(entry, "bot").enabled;
});

function firstLegalMove(state: GameState): Move {
  for (const cell of state.board.flat()) {
    const move = cell.piece?.owner === state.turn ? getLegalMoves(state, cell.square)[0] : undefined;
    if (move) return move;
  }
  throw new Error(`${state.variantKey} has no legal move`);
}

/** The human moves, leaving the bot to reply with `botClockMs` left. */
function botToMove(variantKey: string, botClockMs = 900) {
  const start = createInitialState(variantKey, `bot-flag-${variantKey}`);
  const moved = applyMove(start, firstLegalMove(start));
  const snapshot = { ...moved, clocks: moved.clocks.map(clock => clock.color === moved.turn ? { ...clock, remainingMs: botClockMs, incrementMs: 0 } : clock) };
  return { start, snapshot, humanColor: start.turn };
}

/** What GameBoard.finishBotRequest commits for a bot reply, and the history it then shows and saves. */
function commitBotReply(recorded: GameState[], current: GameState, snapshot: GameState, elapsedMs: number) {
  const frame = botReplyHistoryFrame(snapshot, elapsedMs);
  const nextRecorded = frame ? [...recorded, frame] : recorded;
  const state = applyBotMoveAfterThinking(current, snapshot, firstLegalMove(snapshot), elapsedMs);
  return { recorded: nextRecorded, history: withoutFlaggedBotFrame(nextRecorded, state), state };
}

function saved(state: GameState, history: GameState[], humanColor: GameState["turn"], future: GameState[] = [], botMode: LocalMatchSnapshot["settings"]["botMode"] = "opponent"): LocalMatchSnapshot {
  return { state, history, future, settings: { playMode: "bot", botMode, botDifficulty: botDifficultyLevels[0].key, timeControl: "bullet", humanColor, seatChoice: "first", boardOrientation: "auto" } };
}

function record(id: string, variantKey: string, payload: string): LocalMatchRecord {
  return { version: 1, id, variantKey, payload, revision: 1, updatedAt: 1, ply: 1, completed: true, mode: "bot" };
}

/** Save as writeLocalMatch does, reopen as readLocalMatch does, then export and import the file. */
function saveReopenExport(value: LocalMatchSnapshot) {
  const reopened = decodeLocalMatch(record(value.state.id, value.state.variantKey, encodeLocalMatch(value)));
  expect(reopened).not.toBeNull();
  const imported = importLocalMatch(exportLocalMatch(reopened!).contents);
  expect(imported.state).toEqual({ ...reopened!.state, id: imported.state.id });
  expect(imported.history.map(frame => frame.ply)).toEqual(reopened!.history.map(frame => frame.ply));
  return reopened!;
}

/** Packs a timeline the way older builds saved it, without dropping a repeated flagged turn. */
function legacyPayload(value: LocalMatchSnapshot, frames: GameState[], cursor: number) {
  const nodes: unknown[] = [];
  const pack = (item: unknown): number => {
    const node = Array.isArray(item) ? { a: item.map(pack) }
      : item && typeof item === "object" ? { o: Object.entries(item).filter(([, child]) => child !== undefined).map(([key, child]) => [pack(key), pack(child)]) }
      : item;
    return nodes.push(node) - 1;
  };
  const root = pack({ settings: value.settings, cursor, moves: frames.at(-1)!.moves, frames: frames.map(frame => ({ ...frame, moves: undefined })) });
  return JSON.stringify({ root, nodes });
}

function expectFlagged(state: GameState, humanColor: GameState["turn"]) {
  expect(state).toMatchObject({ ply: 1, status: "completed", outcomeReason: "timeout", result: humanColor });
}

describe("a bot that runs out of time while thinking", () => {
  test.each(botVariants)("%s: the bot's own late reply ends the game without a second frame for its turn", variantKey => {
    const { start, snapshot, humanColor } = botToMove(variantKey);
    const reply = commitBotReply([start], snapshot, snapshot, 1_200);

    expect(reply.recorded).toEqual([start]);
    expectFlagged(reply.state, humanColor);
    const reopened = saveReopenExport(saved(reply.state, reply.history, humanColor));
    expectFlagged(reopened.state, humanColor);
    expect(reopened.history.map(frame => frame.ply)).toEqual([0]);
  });

  test("classic: a reply that lands after the live clock flagged the bot is saved, reopened and exported with one frame per ply", () => {
    const { start, snapshot, humanColor } = botToMove("classic");
    let current = snapshot;
    for (let tick = 0; tick < 4; tick++) current = tickGameClock(current, 250);
    expectFlagged(current, humanColor);

    // The worker measured less time than the live clock did, so its reply still records the turn.
    const reply = commitBotReply([start], current, snapshot, 850);
    expect(reply.recorded.map(frame => frame.ply)).toEqual([0, 1]);
    expect(reply.state).toBe(current);
    expect(reply.history).toEqual([start]);

    const reopened = saveReopenExport(saved(reply.state, reply.history, humanColor));
    expectFlagged(reopened.state, humanColor);
    expect(reopened.history.map(frame => frame.ply)).toEqual([0]);
    // A save written from the recorded timeline is repaired the same way.
    expect(saveReopenExport(saved(reply.state, reply.recorded, humanColor))).toEqual(reopened);
  });

  test("classic: with the bot playing both sides, one undo goes back one move", () => {
    const { start, snapshot, humanColor } = botToMove("classic");
    const flagged = tickGameClock(snapshot, 1_000);
    const reply = commitBotReply([start], flagged, snapshot, 850);
    const undone = undoTimeline(reply.history, reply.state, [])!;

    expect(undone.present).toBe(start);
    const reopened = saveReopenExport(saved(undone.present, undone.past, humanColor, undone.future, "both"));
    expect(reopened.state.ply).toBe(0);
    expect(reopened.future.map(frame => [frame.ply, frame.status])).toEqual([[1, "completed"]]);
  });

  test.each([
    ["at the flagged position", 2, { state: 1, history: [0], future: [] }],
    ["after undo to the start", 0, { state: 0, history: [], future: [1] }],
    ["at the repeated frame", 1, { state: 1, history: [0], future: [] }]
  ])("classic: an older save with a repeated flagged turn reopens and exports (%s)", (_, cursor, plies) => {
    const { start, snapshot, humanColor } = botToMove("classic");
    const flagged = tickGameClock(snapshot, 1_000);
    const value = saved(flagged, [start], humanColor);
    const payload = legacyPayload(value, [start, snapshot, flagged], cursor);

    const reopened = decodeLocalMatch(record(flagged.id, flagged.variantKey, payload));
    expect(reopened).not.toBeNull();
    expect({ state: reopened!.state.ply, history: reopened!.history.map(frame => frame.ply), future: reopened!.future.map(frame => frame.ply) }).toEqual(plies);
    expect([...reopened!.history, reopened!.state, ...reopened!.future].at(-1)).toMatchObject({ status: "completed", outcomeReason: "timeout" });
    const file = JSON.stringify({ format: "allchess-save", version: 1, exportedAt: new Date().toISOString(), game: { id: flagged.id, variantKey: "classic", payload } });
    expect(importLocalMatch(file).state.ply).toBe(plies.state);
    saveReopenExport(reopened!);
  });

  test("classic: a bot reply in time still records its turn and plays the move", () => {
    const { start, snapshot, humanColor } = botToMove("classic", 5_000);
    const reply = commitBotReply([start], snapshot, snapshot, 1_200);

    expect(reply.history.map(frame => frame.ply)).toEqual([0, 1]);
    expect(reply.state).toMatchObject({ ply: 2, status: "active" });
    expect(reply.history[1].clocks.find(clock => clock.color === snapshot.turn)?.remainingMs).toBe(3_800);
    saveReopenExport(saved(reply.state, reply.history, humanColor));
  });
});
