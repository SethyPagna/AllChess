import { z } from "zod";
import { getVariant, type GameState } from "@/lib/variants";
import { botDifficultyLevels } from "@/lib/bot/config";
import { timeControls, type TimeControlKey } from "./time-controls";

const colors = z.enum(["white", "black", "red", "blue", "sente", "gote"]);
const square = z.object({ row: z.number().int().min(-1).max(19), col: z.number().int().min(-1).max(19) });
const piece = z.object({ id: z.string().max(120), code: z.string().min(1).max(8), owner: colors, labelKey: z.string().max(120), promoted: z.boolean().optional() });
const move = z.object({ kind: z.enum(["move", "drop", "pass", "remove"]).optional(), from: square, to: square, promotion: z.boolean().optional(), drop: piece.optional(), notation: z.string().max(200) });
const frame = z.object({
  id: z.string().min(1).max(100), variantKey: z.string().max(64),
  board: z.array(z.array(z.object({ square, terrain: z.enum(["land", "river", "palace", "camp", "den", "trap", "promotion-zone"]).optional(), piece: piece.nullable() })).max(20)).max(20),
  turn: colors, ply: z.number().int().min(0).max(4096), status: z.enum(["active", "completed"]), result: z.union([colors, z.literal("draw")]).optional(),
  outcomeReason: z.enum(["checkmate", "stalemate", "timeout", "three-check", "objective", "royal-captured", "lost-all-pieces", "no-legal-moves", "insufficient-material", "fifty-move", "counting-rule", "repetition", "perpetual-check", "impasse", "scoring", "resignation", "draw"]).optional(),
  clocks: z.array(z.object({ color: colors, remainingMs: z.number().finite().min(0).max(1e12), incrementMs: z.number().finite().min(0).max(86400000) })).length(2),
  captured: z.array(piece).max(4096), checks: z.partialRecord(colors, z.number().int().min(0).max(4096)), halfmoveClock: z.number().int().min(0).max(4096),
  hands: z.partialRecord(colors, z.record(z.string().max(8), z.number().int().min(0).max(400))).optional(), variantState: z.record(z.string(), z.unknown()).optional(),
  review: z.object({ summaryId: z.string().max(200).optional(), completedAt: z.string().max(100).optional() }).optional()
});
const settings = z.object({
  playMode: z.enum(["offline", "bot"]), botMode: z.enum(["human", "opponent", "both"]),
  botDifficulty: z.string().refine(value => botDifficultyLevels.some(level => level.key === value)),
  timeControl: z.string().refine(value => timeControls.some(control => control.key === value)),
  humanColor: colors, seatChoice: z.enum(["random", "first", "second"]), boardOrientation: z.enum(["auto", "first", "second"])
});
export type LocalMatchSettings = Omit<z.infer<typeof settings>, "botDifficulty" | "timeControl"> & { botDifficulty: typeof botDifficultyLevels[number]["key"]; timeControl: TimeControlKey };
export type LocalMatchSnapshot = { state: GameState; history: GameState[]; future: GameState[]; settings: LocalMatchSettings };
export type LocalMatchSummary = { id: string; variantKey: string; updatedAt: number; revision: number; ply: number; completed: boolean; mode: "offline" | "bot" };
export type LocalMatchRecord = LocalMatchSummary & { version: 1; payload: string };

const envelope = z.object({ settings, cursor: z.number().int().min(0).max(2047), moves: z.array(move).max(4096), frames: z.array(frame).min(1).max(2048) });
const maxExpandedMatchSize = 64 * 1024 * 1024;

/** Deduplicate immutable cells, pieces, and rule data across the entire timeline.
 * Moves are stored once, not once per historical position. No engine replay can
 * accidentally discard a counting claim, a multi-capture continuation, or a clock. */
export function encodeLocalMatch(snapshot: LocalMatchSnapshot): string {
  const states = [...snapshot.history, snapshot.state, ...snapshot.future];
  if (states.length > 2048 || states.at(-1)!.moves.length > 4096) throw new Error("This match exceeds the saved timeline limit.");
  const value = { settings: snapshot.settings, cursor: snapshot.history.length, moves: states.at(-1)!.moves, frames: states.map(state => ({ ...state, moves: undefined })) };
  const nodes: unknown[] = [], expandedSizes: number[] = [], keys = new Map<string, number>();
  function intern(item: unknown, depth = 0): number {
    if (depth > 32) throw new Error("This match is too complex to save.");
    let node: unknown = item, expandedSize = 2;
    const childIndex = (child: unknown) => {
      const index = intern(child, depth + 1);
      expandedSize += expandedSizes[index] + 1;
      if (expandedSize > maxExpandedMatchSize) throw new Error("This match is too large to save.");
      return index;
    };
    if (Array.isArray(item)) node = { a: item.map(childIndex) };
    else if (item && typeof item === "object") node = { o: Object.entries(item).filter(([, child]) => child !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [childIndex(key), childIndex(child)]) };
    else expandedSize = JSON.stringify(item)?.length ?? 0;
    const key = JSON.stringify(node);
    if (key === undefined) throw new Error("This match contains unsupported data.");
    const existing = keys.get(key); if (existing !== undefined) return existing;
    if (nodes.length >= 200000) throw new Error("This match is too large to save.");
    const index = nodes.push(node) - 1; expandedSizes.push(expandedSize); keys.set(key, index); return index;
  }
  const root = intern(value);
  const payload = JSON.stringify({ root, nodes });
  if (payload.length > 4 * 1024 * 1024) throw new Error("This match is too large to save.");
  return payload;
}

export function decodeLocalMatch(record: LocalMatchRecord): LocalMatchSnapshot | null {
  try {
    if (record.version !== 1 || typeof record.payload !== "string" || record.payload.length > 4 * 1024 * 1024) return null;
    const packed = JSON.parse(record.payload);
    if (!Array.isArray(packed.nodes) || packed.nodes.length > 200000 || !Number.isInteger(packed.root) || packed.root !== packed.nodes.length - 1) return null;
    const values: unknown[] = [], depths: number[] = [], expandedSizes: number[] = []; let edges = 0;
    for (const node of packed.nodes) {
      let depth = 0, expandedSize = 2;
      const dereference = (index: number) => {
        if (!Number.isInteger(index) || index < 0 || index >= values.length || ++edges > 1000000) throw new Error("Invalid save reference");
        depth = Math.max(depth, depths[index] + 1);
        // A tiny reference graph can otherwise expand exponentially during validation.
        expandedSize += expandedSizes[index] + 1;
        if (expandedSize > maxExpandedMatchSize) throw new Error("Expanded save is too large");
        return values[index];
      };
      let value: unknown;
      if (node === null || typeof node === "string" || typeof node === "boolean" || (typeof node === "number" && Number.isFinite(node))) { value = node; expandedSize = JSON.stringify(node).length; }
      else if (node && Array.isArray(node.a)) value = node.a.map(dereference);
      else if (node && Array.isArray(node.o)) value = Object.fromEntries(node.o.map((pair: unknown[]) => {
        if (!Array.isArray(pair) || pair.length !== 2) throw new Error("Invalid save entry");
        const key = dereference(pair[0] as number);
        if (typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Invalid save key");
        return [key, dereference(pair[1] as number)];
      }));
      else return null;
      if (depth > 32) return null;
      values.push(value); depths.push(depth); expandedSizes.push(expandedSize);
    }
    const parsed = envelope.safeParse(values[packed.root]); if (!parsed.success) return null;
    const data = parsed.data, variant = getVariant(record.variantKey);
    if (data.cursor >= data.frames.length || !variant.players.includes(data.settings.humanColor)) return null;
    const firstPly = data.frames[0].ply;
    for (const [index, position] of data.frames.entries()) {
      if (position.id !== record.id || position.variantKey !== record.variantKey || position.ply !== firstPly + index || position.ply > data.moves.length || !variant.players.includes(position.turn)) return null;
      if (position.clocks.some((clock, i) => clock.color !== variant.players[i]) || position.board.length !== variant.board.rows) return null;
      if (position.board.some((row, r) => row.length !== variant.board.cols || row.some((cell, c) => cell.square.row !== r || cell.square.col !== c || (cell.piece && !variant.players.includes(cell.piece.owner))))) return null;
    }
    if (data.frames.at(-1)!.ply !== data.moves.length) return null;
    const states = data.frames.map(position => ({ ...position, moves: data.moves.slice(0, position.ply) })) as GameState[];
    return { state: states[data.cursor], history: states.slice(0, data.cursor), future: states.slice(data.cursor + 1), settings: data.settings as LocalMatchSettings };
  } catch { return null; }
}
