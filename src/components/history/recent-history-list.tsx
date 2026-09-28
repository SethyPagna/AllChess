import Link from "next/link";

import { getGameCatalogEntry } from "@/lib/catalog";
import { outcomeReasonLabel } from "@/lib/game/outcome";
import type { RuntimeRecentHistory } from "@/lib/history/runtime";

const resultLabels = { win: "Win", loss: "Loss", draw: "Draw", unfinished: "Unfinished" } as const;

export function RecentHistoryList({ history, locale }: { history: RuntimeRecentHistory; locale: string }) {
  const formatDate = createDateFormatter(locale);

  return (
    <div className="cm-list" aria-label="Online games">
      {history.results.map((result) => {
        const date = formatDate(result.completedAt ?? result.createdAt);
        const details = [(result.outcomeReason ? outcomeReasonLabel(result.outcomeReason) : humanize(result.mode)), `${result.movesPlayed} moves`, date].filter(Boolean).join(" · ");

        return (
          <Link key={result.id} href={`/${locale}/analysis/${encodeURIComponent(result.gameId)}` as never} className="cm-row focus-ring">
            <span className="cm-row-main">
              <span className="cm-row-title">{getGameCatalogEntry(result.variantKey)?.name.english ?? result.variantKey}</span>
              <span className="cm-row-sub">{details}</span>
            </span>
            <span className="cm-row-end history-result" data-result={result.result}>
              {resultLabels[result.result] ?? result.result}
              {result.rated && typeof result.ratingDelta === "number" ? <small>{formatDelta(result.ratingDelta)}</small> : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function humanize(value: string) {
  const text = value.replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDelta(delta: number) {
  const rounded = Math.round(delta);
  return rounded > 0 ? `+${rounded}` : rounded < 0 ? `−${Math.abs(rounded)}` : "±0";
}

function createDateFormatter(locale: string) {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  } catch {
    format = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
  }
  return (value: string | null | undefined) => {
    const time = value ? Date.parse(value) : Number.NaN;
    return Number.isNaN(time) ? "" : format.format(time);
  };
}
