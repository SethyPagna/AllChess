import { NextResponse } from "next/server";

import {
  getBotKnowledgeIndexStats,
  getBotRuntimeLanguageProfile,
  listBotEngineLabels,
  listBotKnowledgeSummary,
  listBotModelManifests,
  listBotTrainingReadiness,
  listBotTrainingChecklists,
  listBotToolManifests,
  listTrainingDataManifests
} from "@/lib/bot-training";
import { listBotStrengthBands } from "@/lib/bot-strength";

export function GET() {
  const labels = listBotEngineLabels();
  const labelsByVariant = labels.reduce<Record<string, number>>((counts, label) => {
    const key = label.variantKey ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  return NextResponse.json({
    storage: {
      manifests: "D1",
      largeArtifacts: "R2",
      note: "Runtime gameplay consumes legal cached knowledge first; full neural training artifacts stay outside the browser bundle."
    },
    runtime: getBotRuntimeLanguageProfile(),
    strengthBands: listBotStrengthBands(),
    trainingSummary: listBotKnowledgeSummary(),
    knowledgeIndex: getBotKnowledgeIndexStats(),
    models: listBotModelManifests(),
    engineLabels: {
      total: labels.length,
      byVariant: labelsByVariant,
      legalValidation: "runtime"
    },
    readiness: listBotTrainingReadiness(),
    trainingChecklists: listBotTrainingChecklists(),
    tools: listBotToolManifests(),
    dataSources: listTrainingDataManifests()
  });
}
