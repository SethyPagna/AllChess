import { getBotStrengthBand, type BotStrengthBand, type BotTierKey } from "@/lib/bot-strength";

export const MAX_BOT_REPLY_MS = 2800;

export type { BotTierKey } from "@/lib/bot-strength";
export type BotDifficultyKey = BotTierKey;
export type BotPlayStyle = "balanced" | "tactical" | "positional" | "defensive" | "wild";

export type BotDifficulty = {
  key: BotTierKey;
  label: string;
  estimatedStrength: string;
  strength: BotStrengthBand;
  benchmarkVersion: string;
  depth: number;
  moveTimeMs: number;
  skill: number;
  nodeBudget: number;
  beamWidth: number;
  quiescenceDepth: number;
  riskTolerance: number;
  replyCheckWidth: number;
  knowledgeMinimumConfidence: number;
};

export const botDifficultyLevels: BotDifficulty[] = [
  {
    key: "easy",
    label: "Easy",
    estimatedStrength: "Guided beginner: legal, safe, and still beatable",
    strength: getBotStrengthBand("easy"),
    benchmarkVersion: "allchess-bench-v2",
    depth: 1,
    moveTimeMs: 160,
    skill: 4,
    nodeBudget: 180,
    beamWidth: 6,
    quiescenceDepth: 0,
    riskTolerance: 0.62,
    replyCheckWidth: 2,
    knowledgeMinimumConfidence: 0.82
  },
  {
    key: "normal",
    label: "Normal",
    estimatedStrength: "Club basics with one-reply blunder checks",
    strength: getBotStrengthBand("normal"),
    benchmarkVersion: "allchess-bench-v2",
    depth: 2,
    moveTimeMs: 280,
    skill: 7,
    nodeBudget: 420,
    beamWidth: 9,
    quiescenceDepth: 0,
    riskTolerance: 0.5,
    replyCheckWidth: 4,
    knowledgeMinimumConfidence: 0.78
  },
  {
    key: "hard",
    label: "Hard",
    estimatedStrength: "Tactical club with defended-piece checks",
    strength: getBotStrengthBand("hard"),
    benchmarkVersion: "allchess-bench-v2",
    depth: 3,
    moveTimeMs: 650,
    skill: 10,
    nodeBudget: 1600,
    beamWidth: 14,
    quiescenceDepth: 1,
    riskTolerance: 0.35,
    replyCheckWidth: 7,
    knowledgeMinimumConfidence: 0.72
  },
  {
    key: "very-hard",
    label: "Very Hard",
    estimatedStrength: "Expert practice with stronger positional weighting",
    strength: getBotStrengthBand("very-hard"),
    benchmarkVersion: "allchess-bench-v2",
    depth: 4,
    moveTimeMs: 1200,
    skill: 14,
    nodeBudget: 4200,
    beamWidth: 22,
    quiescenceDepth: 1,
    riskTolerance: 0.22,
    replyCheckWidth: 11,
    knowledgeMinimumConfidence: 0.66
  },
  {
    key: "grandmaster",
    label: "Grandmaster",
    estimatedStrength: "Engine-backed master benchmark",
    strength: getBotStrengthBand("grandmaster"),
    benchmarkVersion: "allchess-bench-v2",
    depth: 5,
    moveTimeMs: 2100,
    skill: 18,
    nodeBudget: 12000,
    beamWidth: 34,
    quiescenceDepth: 2,
    riskTolerance: 0.1,
    replyCheckWidth: 17,
    knowledgeMinimumConfidence: 0.6
  },
  {
    key: "legend",
    label: "Legend",
    estimatedStrength: "Fast cache-first benchmark with deepest safe search",
    strength: getBotStrengthBand("legend"),
    benchmarkVersion: "allchess-bench-v2",
    depth: 7,
    moveTimeMs: 2600,
    skill: 20,
    nodeBudget: 28000,
    beamWidth: 46,
    quiescenceDepth: 4,
    riskTolerance: 0.03,
    replyCheckWidth: 24,
    knowledgeMinimumConfidence: 0.55
  }
];
