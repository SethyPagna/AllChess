import { Bot, Brain, Database, Gauge } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";
import type { getBotTrainingGateSummary, listBotKnowledgeSummary } from "@/lib/bot/training";
import type { BotStrengthBand } from "@/lib/bot/strength";

type CatalogTrainingMetricsProps = {
  knowledge: ReturnType<typeof listBotKnowledgeSummary>;
  legendBand: BotStrengthBand;
  trainingGate: ReturnType<typeof getBotTrainingGateSummary>;
};

export function CatalogTrainingMetrics({ knowledge, legendBand, trainingGate }: CatalogTrainingMetricsProps) {
  return (
    <div className="panel bot-training-metrics" aria-label="Bot training status">
      <div>
        <span>
          <Database size={16} />
          Book & tactics
          <InfoHint text="Cached openings and tactical patterns are checked before live search." />
        </span>
        <strong>{knowledge.entries.toLocaleString()}</strong>
        <small>{knowledge.tacticEntries.toLocaleString()} tactics</small>
      </div>
      <div>
        <span>
          <Brain size={16} />
          Move labels
          <InfoHint text="Compact records rank candidate moves before the bot spends time searching." />
        </span>
        <strong>{knowledge.engineLabels.toLocaleString()}</strong>
        <small>{knowledge.toolsDiscovered} sources indexed</small>
      </div>
      <div>
        <span>
          <Gauge size={16} />
          Legend
          <InfoHint text={legendBand.basis} />
        </span>
        <strong>{legendBand.display}</strong>
        <small>{legendBand.calibrationStatus.replace(/-/g, " ")}</small>
      </div>
      <div>
        <span>
          <Bot size={16} />
          Release gate
          <InfoHint text={trainingGate.notice} />
        </span>
        <strong>{trainingGate.playableVariants.length} ready</strong>
        <small>{trainingGate.gatedVariants.length} guide gated</small>
      </div>
    </div>
  );
}
