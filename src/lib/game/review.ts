import type { GameState, Move } from "@/lib/variants";

export type MoveTimelineEntry = {
  ply: number;
  notation: string;
  kind: NonNullable<Move["kind"]>;
  captureCount: number | null;
  promotion: boolean;
  label: string | null;
};

type RecordedMove = Move & { notation: string };

/** Replay metadata only. Move quality requires a separate position evaluation. */
export function buildMoveTimeline(moves: readonly RecordedMove[], timeline: readonly GameState[] = []): MoveTimelineEntry[] {
  const positions = new Map(timeline.map(state => [state.moves.length, state]));
  return moves.map((move, index) => {
    const kind = move.kind ?? (move.drop ? "drop" : "move");
    const before = positions.get(index);
    const after = positions.get(index + 1);
    const recorded = after?.moves[index];
    const hasPositionPair = Boolean(before && after && before.id === after.id && before.variantKey === after.variantKey && recorded && sameMove(recorded, move));
    // Captures can happen away from the destination (jumps and en passant), and
    // notation may omit captures. Only consecutive positions establish a count.
    const captureCount = hasPositionPair ? Math.max(0, after!.captured.length - before!.captured.length) : null;
    const fromPiece = hasPositionPair ? before!.board[move.from.row]?.[move.from.col]?.piece : null;
    const toPiece = hasPositionPair ? after!.board[move.to.row]?.[move.to.col]?.piece : null;
    const promotion = kind === "move" && (move.promotion === true || Boolean(fromPiece && toPiece && toPiece.id === fromPiece.id && toPiece.promoted && !fromPiece.promoted));
    const labels: string[] = [];
    if (kind === "pass") labels.push("Pass");
    else if (kind === "remove") labels.push("Remove");
    else if (kind === "drop") labels.push("Drop");
    if (captureCount) labels.push(captureCount === 1 ? "Capture" : `${captureCount} captures`);
    if (promotion) labels.push("Promotion");
    return { ply: index + 1, notation: move.notation, kind, captureCount, promotion, label: labels.join(" · ") || null };
  });
}

export function summarizeMoves(moves: readonly MoveTimelineEntry[]) {
  return {
    moves: moves.length,
    captures: moves.some(move => move.captureCount === null) ? null : moves.reduce((count, move) => count + move.captureCount!, 0),
    promotions: moves.filter(move => move.promotion).length,
    drops: moves.filter(move => move.kind === "drop").length,
    passes: moves.filter(move => move.kind === "pass").length,
    removals: moves.filter(move => move.kind === "remove").length
  };
}

function sameMove(a: RecordedMove, b: RecordedMove) {
  return a.notation === b.notation && a.kind === b.kind && a.from.row === b.from.row && a.from.col === b.from.col && a.to.row === b.to.row && a.to.col === b.to.col && a.promotion === b.promotion && a.drop?.code === b.drop?.code && a.drop?.owner === b.drop?.owner;
}
