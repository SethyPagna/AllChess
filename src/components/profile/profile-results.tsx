import Link from "next/link";

import { ProfileEmptyState } from "@/components/profile/profile-empty-state";
import { getGameCatalogEntry } from "@/lib/catalog";
import { outcomeReasonLabel } from "@/lib/game/outcome";
import type { RuntimeProfileHistory } from "@/lib/profile/runtime";

type ProfileResultsProps = {
  history: RuntimeProfileHistory;
  locale: string;
};

type ProfileResult = RuntimeProfileHistory["results"][number];

export function ProfileResults({ history, locale }: ProfileResultsProps) {
  const formatDate = dateFormatter(locale);

  return (
    <section className="profile-list" aria-labelledby="profile-recent">
      <div className="profile-list-head">
        <h2 id="profile-recent">Recent matches</h2>
      </div>
      {history.results.length ? (
        <ul>
          {history.results.map((result) => (
            <li key={result.id}>
              <Link href={`/${locale}/analysis/${result.gameId}`} className="profile-row focus-ring">
                <span className="profile-row-game">
                  <strong>{getGameCatalogEntry(result.variantKey)?.name.english ?? result.variantKey}</strong>
                  <small>{[result.outcomeReason ? outcomeReasonLabel(result.outcomeReason) : "Recorded result", formatDate(result.completedAt ?? result.createdAt)].filter(Boolean).join(" · ")}</small>
                </span>
                <span className="profile-row-result" data-result={result.result}>{capitalize(result.result)}</span>
                <span className="profile-row-delta">{ratingDelta(result)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ProfileEmptyState locale={locale} />
      )}
    </section>
  );
}

function ratingDelta({ ratingDelta: delta }: ProfileResult) {
  if (delta == null) return "Unrated";
  return `${delta > 0 ? "+" : ""}${delta}`;
}

function capitalize(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function dateFormatter(locale: string) {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  } catch {
    format = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
  }
  return (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : format.format(date);
  };
}
