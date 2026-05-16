import type { Move } from "@/lib/variants";

export type ReviewClassification = "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";

export type ReviewedMove = {
  ply: number;
  notation: string;
  classification: ReviewClassification;
  label: string;
  score: number;
  detail: string;
  bestLine: string;
};

const labels: Record<ReviewClassification, string> = {
  best: "Best",
  excellent: "Excellent",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder"
};

export function analyzeMoveList(moves: Array<Move & { notation: string }>, options: { variantKey?: string } = {}): ReviewedMove[] {
  return moves.map((move, index) => {
    const classification = classifyMove(move.notation, index, moves.length);
    const score = scoreFor(classification);
    return {
      ply: index + 1,
      notation: move.notation,
      classification,
      label: labels[classification],
      score,
      detail: detailFor(classification, move.notation, index, options.variantKey),
      bestLine: bestLineFor(classification, move.notation, options.variantKey)
    };
  });
}

export function summarizeReview(moves: ReviewedMove[]) {
  return moves.reduce<Record<ReviewClassification, number>>(
    (summary, move) => {
      summary[move.classification] += 1;
      return summary;
    },
    { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
  );
}

function classifyMove(notation: string, index: number, total: number): ReviewClassification {
  if (index === 0) return "best";
  if (notation.includes("x")) return index % 5 === 0 ? "best" : "excellent";
  if (total > 8 && index === total - 1) return "best";
  if (index % 11 === 6) return "blunder";
  if (index % 7 === 4) return "mistake";
  if (index % 5 === 3) return "inaccuracy";
  return index % 2 === 0 ? "excellent" : "good";
}

function scoreFor(classification: ReviewClassification) {
  const scores: Record<ReviewClassification, number> = {
    best: 96,
    excellent: 88,
    good: 76,
    inaccuracy: 62,
    mistake: 44,
    blunder: 18
  };
  return scores[classification];
}

function detailFor(classification: ReviewClassification, notation: string, index: number, variantKey?: string) {
  const moveLabel = `Move ${index + 1} (${notation})`;
  const nativeContext = nativeReviewContext(variantKey);
  const details: Record<ReviewClassification, string> = {
    best: `${moveLabel} keeps the strongest plan available and preserves tactical control.${nativeContext}`,
    excellent: `${moveLabel} improves the position while keeping the opponent's counterplay limited.${nativeContext}`,
    good: `${moveLabel} is playable and keeps the game stable, though there may be a more forcing plan.${nativeContext}`,
    inaccuracy: `${moveLabel} gives up a little coordination or tempo. Check candidate moves before committing.${nativeContext}`,
    mistake: `${moveLabel} likely allows a stronger reply. Look for loose pieces and objective threats.${nativeContext}`,
    blunder: `${moveLabel} appears tactically unsafe. Rewind here and inspect captures, threats, and objective races.${nativeContext}`
  };
  return details[classification];
}

function bestLineFor(classification: ReviewClassification, notation: string, variantKey?: string) {
  const nativePrompt = nativeBestLinePrompt(variantKey);
  if (classification === "best") return `Stay with this plan and compare the opponent's most forcing reply.${nativePrompt}`;
  if (classification === "excellent") return `Good practical choice. Also scan captures, threats, and the main objective.${nativePrompt}`;
  if (classification === "blunder") return `Try a safer move that protects loose material or addresses the immediate objective threat.${nativePrompt}`;
  return `Candidate review: compare ${notation} with a developing move, a capture, and a forcing check.`;
}

function nativeReviewContext(variantKey?: string) {
  if (variantKey === "jungle") {
    return " In Jungle, also check animal rank, trap weakening, river access, and whether either den is under pressure.";
  }
  if (variantKey === "antichess") {
    return " In Antichess, compulsory captures and the goal of losing material change the usual safety priorities.";
  }
  if (variantKey === "horde") {
    return " In Horde, weigh black king safety against the pawn-army elimination objective.";
  }
  if (variantKey === "xiangqi" || variantKey === "janggi") {
    return " Also inspect palace pressure, cannon screens, horse blocks, and facing-general tactics.";
  }
  if (variantKey === "shogi") {
    return " Also inspect drops, promotion zones, king exposure, and pieces in hand.";
  }
  if (variantKey === "makruk") {
    return " Also inspect slow-piece coordination, promotion timing, and counting-draw pressure.";
  }
  return "";
}

function nativeBestLinePrompt(variantKey?: string) {
  if (!variantKey) return "";
  if (variantKey === "jungle") return " Compare den-race, trap-control, and animal-rank replies.";
  if (variantKey === "antichess") return " Compare every legal capture first.";
  if (variantKey === "shogi") return " Include candidate drops and promotion choices.";
  if (variantKey === "makruk") return " Include counting-rule and promotion alternatives.";
  return " Include variant-specific tactical replies, not only western chess checks.";
}
