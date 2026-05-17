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
    estimatedStrength: "Guided beginner: legal, safe, tactical, and still beatable",
    strength: getBotStrengthBand("easy"),
    benchmarkVersion: "allchess-bench-v2",
    depth: 2,
    moveTimeMs: 220,
    skill: 6,
    nodeBudget: 360,
    beamWidth: 8,
    quiescenceDepth: 0,
    riskTolerance: 0.52,
    replyCheckWidth: 3,
    knowledgeMinimumConfidence: 0.78
  },
  {
    key: "normal",
    label: "Normal",
    estimatedStrength: "Club basics with tactical and retreat checks",
    strength: getBotStrengthBand("normal"),
    benchmarkVersion: "allchess-bench-v2",
    depth: 3,
    moveTimeMs: 420,
    skill: 9,
    nodeBudget: 950,
    beamWidth: 12,
    quiescenceDepth: 1,
    riskTolerance: 0.42,
    replyCheckWidth: 6,
    knowledgeMinimumConfidence: 0.74
  },
  {
    key: "hard",
    label: "Hard",
    estimatedStrength: "Tactical club with counterplay and king-safety checks",
    strength: getBotStrengthBand("hard"),
    benchmarkVersion: "allchess-bench-v2",
    depth: 4,
    moveTimeMs: 780,
    skill: 12,
    nodeBudget: 2600,
    beamWidth: 18,
    quiescenceDepth: 1,
    riskTolerance: 0.28,
    replyCheckWidth: 10,
    knowledgeMinimumConfidence: 0.68
  },
  {
    key: "very-hard",
    label: "Very Hard",
    estimatedStrength: "Expert practice with deeper plans and sacrifice filters",
    strength: getBotStrengthBand("very-hard"),
    benchmarkVersion: "allchess-bench-v2",
    depth: 5,
    moveTimeMs: 1400,
    skill: 16,
    nodeBudget: 6800,
    beamWidth: 28,
    quiescenceDepth: 2,
    riskTolerance: 0.16,
    replyCheckWidth: 15,
    knowledgeMinimumConfidence: 0.62
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
