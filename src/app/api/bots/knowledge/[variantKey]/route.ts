import { NextResponse } from "next/server";

import { listBotKnowledge } from "@/lib/bot-training";

export function GET(_request: Request, { params }: { params: Promise<{ variantKey: string }> }) {
  return params.then(({ variantKey }) =>
    NextResponse.json({
      variantKey,
      positionKeyFormat: "{variantKey}|turn:{turn}|moves:{uci move history}",
      entries: listBotKnowledge(variantKey).map((entry) => ({
        id: entry.id,
        variantKey: entry.variantKey,
        positionKey: entry.positionKey,
        boardSignature: entry.boardSignature,
        moveUci: entry.moveUci,
        source: entry.source,
        minTier: entry.minTier,
        confidence: entry.confidence,
        benchmarkVersion: entry.benchmarkVersion,
        tags: entry.tags,
        explanation: entry.explanation
      }))
    })
  );
}
