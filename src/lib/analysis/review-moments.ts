export type AnalysisMoveSummary = {
  notation: string;
  ply: number;
};

export type ReviewMoment = {
  label: string;
  move: string;
  ply?: number;
};

export type ReviewLabelTone = "critical" | "neutral" | "positive" | "warning";

const POSITIVE_REVIEW_LABELS = new Set(["best", "brilliant", "excellent", "good", "great"]);
const WARNING_REVIEW_LABELS = new Set(["dubious", "inaccuracy", "mistake", "missed chance"]);
const CRITICAL_REVIEW_LABELS = new Set(["blunder", "critical", "miss", "missed win"]);

export function normalizeSelectedMoveIndex(value: string | undefined, moves: AnalysisMoveSummary[]) {
  if (!moves.length) return 0;
  const requestedPly = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(requestedPly)) return 0;
  const requestedIndex = moves.findIndex((move) => move.ply === requestedPly);

  return requestedIndex >= 0 ? requestedIndex : 0;
}

export function extractReviewMoments(report: unknown): ReviewMoment[] {
  if (!isRecord(report) || !Array.isArray(report.moments)) return [];

  return report.moments
    .map((moment) => {
      if (!isRecord(moment)) return null;
      const label = normalizeDetailText(moment.label);
      const move = normalizeDetailText(moment.move);
      const ply = normalizePly(moment.ply);
      if (!label && !move && !ply) return null;
      const reviewMoment: ReviewMoment = { label: label || "Moment", move: move || (ply ? `Ply ${ply}` : "Saved position") };
      if (ply) reviewMoment.ply = ply;
      return reviewMoment;
    })
    .filter((moment): moment is ReviewMoment => Boolean(moment))
    .slice(0, 4);
}

export function createReviewMomentByMove(moments: ReviewMoment[], moves: AnalysisMoveSummary[]) {
  const momentsByMove = new Map<string, ReviewMoment>();
  for (const moment of moments) {
    const key = reviewMomentKey(moment.move);
    if (key) momentsByMove.set(key, moment);
  }

  const matchedMoments = new Map<string, ReviewMoment>();
  for (const move of moves) {
    const key = reviewMomentKey(move.notation);
    const moment = moments.find((item) => item.ply === move.ply) ?? momentsByMove.get(key);
    if (moment) matchedMoments.set(key, { ...moment, ply: move.ply });
  }

  return matchedMoments;
}

export function createReviewMomentLinks(moments: ReviewMoment[], momentsByMove: Map<string, ReviewMoment>) {
  return moments.map((moment) => ({
    moment,
    ply: moment.ply ?? momentsByMove.get(reviewMomentKey(moment.move))?.ply
  }));
}

export function countReviewLabels(moments: ReviewMoment[]) {
  const counts = new Map<string, number>();
  for (const moment of moments) {
    const label = normalizeDetailText(moment.label).toLowerCase();
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts, ([label, count]) => ({ count, label, tone: reviewLabelTone(label) })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function reviewLabelTone(label: string): ReviewLabelTone {
  const normalizedLabel = normalizeDetailText(label).toLowerCase();
  if (POSITIVE_REVIEW_LABELS.has(normalizedLabel)) return "positive";
  if (WARNING_REVIEW_LABELS.has(normalizedLabel)) return "warning";
  if (CRITICAL_REVIEW_LABELS.has(normalizedLabel)) return "critical";

  return "neutral";
}

export function getReviewMomentForMove(moments: Map<string, ReviewMoment>, move: AnalysisMoveSummary) {
  return moments.get(reviewMomentKey(move.notation));
}

export function reviewMomentKey(value: unknown) {
  return normalizeDetailText(value).toLowerCase();
}

export function extractTrainingIdeas(report: unknown): string[] {
  if (!isRecord(report) || !Array.isArray(report.training)) return [];

  return report.training.map(normalizeDetailText).filter(Boolean).slice(0, 4);
}

function normalizeDetailText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePly(value: unknown) {
  const ply = Number(value);
  return Number.isInteger(ply) && ply > 0 ? ply : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
