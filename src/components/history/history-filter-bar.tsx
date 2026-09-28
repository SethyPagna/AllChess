import Link from "next/link";
import { Search } from "lucide-react";

import type { HistoryResultFilter, RuntimeRecentHistory } from "@/lib/history/runtime";

const resultFilters: { key: HistoryResultFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "win", label: "Wins" },
  { key: "loss", label: "Losses" },
  { key: "draw", label: "Draws" },
  { key: "unfinished", label: "Unfinished" }
];

function historyHref(locale: string, values: { q?: string; result?: HistoryResultFilter } = {}) {
  const query = new URLSearchParams();
  if (values.q) query.set("q", values.q);
  if (values.result && values.result !== "all") query.set("result", values.result);
  const suffix = query.toString();
  return suffix ? `/${locale}/history?${suffix}` : `/${locale}/history`;
}

export function HistoryFilterBar({ history, locale }: { history: RuntimeRecentHistory; locale: string }) {
  const { query, result } = history.filters;

  return (
    <form className="cm-toolbar" aria-label="History filters" action={`/${locale}/history`}>
      <div className="cm-search" title="Search by game, opponent, mode, or result.">
        <button type="submit" className="focus-ring" aria-label="Search" title="Search"><Search size={15} /></button>
        <input type="search" name="q" defaultValue={query} placeholder="Search saved games" aria-label="Search history" enterKeyHint="search" />
      </div>
      {result !== "all" ? <input type="hidden" name="result" value={result} /> : null}
      <div className="cm-chips" role="group" aria-label="Filter history result">
        {resultFilters.map((filter) => (
          <Link key={filter.key} href={historyHref(locale, { q: query, result: filter.key }) as never} className="cm-chip focus-ring" aria-current={result === filter.key ? true : undefined}>
            {filter.label}
          </Link>
        ))}
      </div>
    </form>
  );
}
