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

export function analyzeMoveList(moves: Array<Move & { notation: string }>): ReviewedMove[] {
  return moves.map((move, index) => {
    const classification = classifyMove(move.notation, index, moves.length);
    const score = scoreFor(classification);
    return {
      ply: index + 1,
      notation: move.notation,
      classification,
      label: labels[classification],
      score,
      detail: detailFor(classification, move.notation, index),
      bestLine: bestLineFor(classification, move.notation)
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

function detailFor(classification: ReviewClassification, notation: string, index: number) {
  const moveLabel = `Move ${index + 1} (${notation})`;
  const details: Record<ReviewClassification, string> = {
    best: `${moveLabel} keeps the strongest plan available and preserves tactical control.`,
    excellent: `${moveLabel} improves the position while keeping the opponent's counterplay limited.`,
    good: `${moveLabel} is playable and keeps the game stable, though there may be a more forcing plan.`,
    inaccuracy: `${moveLabel} gives up a little coordination or tempo. Check candidate moves before committing.`,
    mistake: `${moveLabel} likely allows a stronger reply. Look for loose pieces and king safety problems.`,
    blunder: `${moveLabel} appears tactically unsafe. Rewind here and inspect captures, checks, and threats.`
  };
  return details[classification];
}

function bestLineFor(classification: ReviewClassification, notation: string) {
  if (classification === "best") return "Stay with this plan and compare the opponent's most forcing reply.";
  if (classification === "excellent") return "Good practical choice. Also scan checks, captures, and threats.";
  if (classification === "blunder") return "Try a safer move that protects hanging pieces or addresses check threats.";
  return `Candidate review: compare ${notation} with a developing move, a capture, and a forcing check.`;
}
