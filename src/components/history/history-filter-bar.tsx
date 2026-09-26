import { FormChoicePicker } from "@/components/ui/form-choice-picker";
import { Search } from "lucide-react";

import type { RuntimeRecentHistory } from "@/lib/history/runtime";

type HistoryFilterBarProps = {
  hasSavedRows: boolean;
  history: RuntimeRecentHistory;
};

export function HistoryFilterBar({ hasSavedRows, history }: HistoryFilterBarProps) {
  return (
    <form className={`record-filter-row panel ${hasSavedRows ? "" : "is-empty"}`} aria-label="History filters">
      <label className="catalog-search" title="Search saved games by game, variant, opponent, mode, or result.">
        <Search size={18} />
        <span className="sr-only">Search history</span>
        <input aria-label="Search history" name="q" defaultValue={history.filters.query} placeholder="Search saved games" />
      </label>
      <FormChoicePicker key={history.filters.result} name="result" label="Filter history result" defaultValue={history.filters.result} options={[{key: "all", label: "All games"}, {key: "win", label: "Wins"}, {key: "loss", label: "Losses"}, {key: "draw", label: "Draws"}, {key: "unfinished", label: "Unfinished"}]} />
      <button type="submit" className="focus-ring record-filter-chip">
        Search
      </button>
      <span className="record-filter-chip" aria-disabled="true">Recent first</span>
    </form>
  );
}
