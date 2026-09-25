import { z } from "zod";
import { getVariant } from "@/lib/variants";
import { getGameCatalogEntry, getCatalogModeSupport } from "@/lib/catalog";
import { decodeLocalMatch, encodeLocalMatch, type LocalMatchSnapshot } from "./local-match";

export const maxMatchFileBytes = 16 * 1024 * 1024;
const fileSchema = z.object({
  format: z.literal("allchess-save"), version: z.literal(1), exportedAt: z.string().datetime(),
  game: z.object({ id: z.string().min(1).max(100), variantKey: z.string().max(64), payload: z.string().max(4 * 1024 * 1024) }).strict()
}).strict();
const count = z.object({ phase: z.enum(["board", "pieces"]), side: z.enum(["white", "black"]), count: z.number().int().min(1).max(10000), limit: z.number().int().min(1).max(10000), firstMovePending: z.boolean(), startedAtPly: z.number().int().min(0).max(4096) });
const countEvents = z.array(z.object({ ply: z.number().int().min(0).max(4096), actor: z.enum(["white", "black"]), action: z.enum(["start-board", "start-pieces", "stop", "claim-draw"]) })).max(10000);
// These values are consumed directly by counting controls and the rule engine.
// Keep unfamiliar metadata intact for forward compatibility, but reject malformed
// known fields instead of silently erasing rules from an imported game.
const ruleData = z.object({
  oukCount: count.optional(), makrukHonorCount: count.optional(),
  oukCountEvents: countEvents.optional(), makrukCountEvents: countEvents.optional(),
  oukLeapUsed: z.record(z.string(), z.boolean()).optional(),
  shogiRepetition: z.object({ key: z.string(), count: z.number().int().min(0).max(4097), occurrences: z.record(z.string(), z.number().int().min(0).max(4097)), checker: z.enum(["sente", "gote"]).nullable() }).optional()
}).passthrough();

function checkedSnapshot(id: string, variantKey: string, payload: string) {
  const snapshot = decodeLocalMatch({ version: 1, id, variantKey, payload, revision: 0, updatedAt: 0, ply: 0, completed: false, mode: "offline" });
  if (!snapshot) throw new Error("This file contains an incomplete or damaged game. Existing saves are unchanged.");
  const entry = getGameCatalogEntry(variantKey);
  if (!entry || !getCatalogModeSupport(entry, snapshot.settings.playMode).enabled) throw new Error("This game or mode is not supported on this version of AllChess.");
  const variant = getVariant(variantKey);
  const codes = new Set(variant.setup.join("").toLowerCase().replaceAll(".", ""));
  if (variant.family === "draughts") codes.add("x");
  if (variant.family === "western" && variant.supportsPromotion) codes.add("q");
  for (const frame of [...snapshot.history, snapshot.state, ...snapshot.future]) {
    const pieces = [...frame.board.flat().flatMap(cell => cell.piece ? [cell.piece] : []), ...frame.captured];
    if (pieces.some(piece => !codes.has(piece.code) || !variant.players.includes(piece.owner)) || Object.entries(frame.hands ?? {}).some(([owner, hand]) => !variant.players.some(player => player === owner) || Object.keys(hand).some(code => !codes.has(code)))) throw new Error("This game contains an unsupported piece.");
    if (frame.variantState && !ruleData.safeParse(frame.variantState).success) throw new Error("This game contains damaged rule information. Existing saves are unchanged.");
  }
  const onBoard = (square: { row: number; col: number }) => square.row >= 0 && square.row < variant.board.rows && square.col >= 0 && square.col < variant.board.cols;
  for (const move of (snapshot.future.at(-1) ?? snapshot.state).moves) {
    if (move.drop && (!variant.supportsDrops || !codes.has(move.drop.code) || !variant.players.includes(move.drop.owner))) throw new Error("This game contains an unsupported piece.");
    if (move.kind === "pass" ? variant.key !== "janggi" : !onBoard(move.to) || (!move.drop && !onBoard(move.from))) throw new Error("This game contains a damaged move history.");
  }
  return snapshot;
}

export function exportLocalMatch(snapshot: LocalMatchSnapshot, now = new Date()) {
  const { id, variantKey } = snapshot.state, payload = encodeLocalMatch(snapshot);
  checkedSnapshot(id, variantKey, payload);
  const contents = JSON.stringify({ format: "allchess-save", version: 1, exportedAt: now.toISOString(), game: { id, variantKey, payload } });
  if (new TextEncoder().encode(contents).byteLength > maxMatchFileBytes) throw new Error("This game is too large to export.");
  return { contents, filename: `allchess-${getVariant(variantKey).key}-${now.toISOString().slice(0, 10)}.allchess.json` };
}

/** Every import is an independent local copy; no imported ID can overwrite a save. */
export function importLocalMatch(contents: string, newId = crypto.randomUUID()): LocalMatchSnapshot {
  if (contents.length > maxMatchFileBytes || new TextEncoder().encode(contents).byteLength > maxMatchFileBytes) throw new Error("Choose an AllChess game file smaller than 16 MB.");
  let raw: unknown;
  try { raw = JSON.parse(contents); } catch { throw new Error("This is not a readable AllChess game file."); }
  const parsed = fileSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Choose a supported AllChess game file (.allchess.json).");
  const { id, variantKey, payload } = parsed.data.game;
  const snapshot = checkedSnapshot(id, variantKey, payload);
  const copyFrame = (frame: LocalMatchSnapshot["state"]) => ({ ...frame, id: newId });
  return { ...snapshot, state: copyFrame(snapshot.state), history: snapshot.history.map(copyFrame), future: snapshot.future.map(copyFrame) };
}

export function downloadLocalMatch(snapshot: LocalMatchSnapshot) {
  const file = exportLocalMatch(snapshot);
  const url = URL.createObjectURL(new Blob([file.contents], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = file.filename;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
