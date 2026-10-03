import type { z } from "zod";
import type { Move } from "@/lib/variants";

type MoveRequestShape = { kind?: Move["kind"]; from?: Move["from"]; to: Move["to"]; drop?: unknown };

/** Removals exist only in Konane's opening, so every other variant rejects kind "remove". */
export function moveKindAllowed(variantKey: string, kind: Move["kind"]) {
  return kind !== "remove" || variantKey === "konane";
}

/** Shape rules for move payloads: a removal lifts the stone it names (to == from) and a drop names its piece. */
export function refineMoveRequest(move: MoveRequestShape, context: z.RefinementCtx) {
  if (move.kind === "remove" && (!move.from || move.from.row !== move.to.row || move.from.col !== move.to.col)) {
    context.addIssue({ code: "custom", path: ["to"], message: "A removal names a single square." });
  }
  if (move.kind === "drop" && !move.drop) {
    context.addIssue({ code: "custom", path: ["drop"], message: "Drop moves require a dropped piece." });
  }
}
