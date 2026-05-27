import { NextResponse } from "next/server";

import { listBotKnowledge, listVariantTrainingCoverage } from "@/lib/bot/training";

export function GET(_request: Request, { params }: { params: Promise<{ variantKey: string }> }) {
  return params.then(({ variantKey }) =>
    NextResponse.json({
      variantKey,
      positionKeyFormat: "{variantKey}|turn:{turn}|moves:{uci move history}",
      coverage: listVariantTrainingCoverage(variantKey)[0] ?? null,
      entries: listBotKnowledge(variantKey).map((entry) => ({
        id: entry.id,
        variantKey: entry.variantKey,
        positionKey: entry.positionKey,
        boardSignature: entry.boardSignature,
        moveUci: entry.moveUci,
        source: entry.source,
        minTier: entry.minTier,
        tierTargets: entry.tierTargets,
        positionHash: entry.positionHash,
        sourceFileId: entry.sourceFileId,
        sourceLicense: entry.sourceLicense,
        labelDepth: entry.labelDepth,
        engine: entry.engine,
        confidence: entry.confidence,
        split: entry.split,
        benchmarkVersion: entry.benchmarkVersion,
        generatedAt: entry.generatedAt,
        tags: entry.tags,
        explanation: entry.explanation
      }))
    })
  );
}
