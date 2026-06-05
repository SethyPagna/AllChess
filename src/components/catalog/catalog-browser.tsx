"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Bot, ChevronDown, Filter, Play, RotateCcw, Search, X } from "lucide-react";

import { CatalogModeGrid, CatalogModeStrip, catalogModeKeys, catalogModeLabels } from "@/components/catalog/catalog-mode-support";
import {
  displayBotReadiness,
  displayGameName,
  displayPiecePresentation,
  displayPlayabilityStatus,
  displayReleaseReadiness,
  displayRulesReadiness,
  gameFamilies,
  getCatalogModeSupport,
  type CatalogPlayMode,
  type GameCatalogEntry,
  type GameFamilyKey,
  type PlayabilityStatus
} from "@/lib/catalog";
import type { LocaleCode } from "@/lib/i18n/locales";
import { playGameHref } from "@/lib/routing/play-links";

type CatalogBrowserProps = {
  entries: GameCatalogEntry[];
  initialFamily?: GameFamilyKey | "all";
  initialMode?: CatalogPlayMode | "all";
  initialStatus?: PlayabilityStatus | "all";
  locale: LocaleCode;
};

const playabilityLabels: Record<PlayabilityStatus | "all", string> = {
  all: "All",
  playable: "Ready to play",
  learn: "Guide first",
  "coming-soon": "In progress"
};

const familySelectLabels: Record<GameFamilyKey | "all", string> = {
  all: "All families",
  "chess-family": "Chess family",
  "asian-chess": "Asian chess systems",
  draughts: "Draughts and checkers",
  mancala: "Mancala",
  "go-family": "Go, Gomoku, and territory",
  tables: "Tables and backgammon",
  tafl: "Tafl games",
  race: "Race games",
  mill: "Mill games",
  regional: "Regional classics"
};

export function CatalogBrowser({ entries, initialFamily = "all", initialMode = "all", initialStatus = "all", locale }: CatalogBrowserProps) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<GameFamilyKey | "all">(initialFamily);
  const [mode, setMode] = useState<CatalogPlayMode | "all">(initialMode);
  const [status, setStatus] = useState<PlayabilityStatus | "all">(initialStatus);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GameCatalogEntry | null>(null);

  const filtered = useMemo(() => {
    const normalized = normalize(query);
    return entries.filter((entry) => {
      if (family !== "all" && entry.family !== family) return false;
      if (mode !== "all" && !getCatalogModeSupport(entry, mode).enabled) return false;
      if (status !== "all" && entry.playability !== status) return false;
      if (!normalized) return true;
      return [entry.id, entry.name.english, entry.name.native, entry.name.romanization, entry.name.short, ...entry.aliases]
        .filter(Boolean)
        .some((value) => normalize(value ?? "").includes(normalized));
    });
  }, [entries, family, mode, query, status]);
  const hasFilters = Boolean(query) || family !== "all" || mode !== "all" || status !== "all";
  const filterCount = [family !== "all", mode !== "all", status !== "all"].filter(Boolean).length;

  return (
    <section className="catalog-browser">
      <div className="catalog-toolbar panel">
        <label className="catalog-search focus-within:ring-2 focus-within:ring-[var(--accent)]">
          <Search size={18} />
          <span className="sr-only">Search games</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games" />
        </label>
        <div className={`catalog-filter-popover${filtersOpen ? " is-open" : ""}`}>
          <button
            type="button"
            className="catalog-filter-trigger focus-ring"
            aria-expanded={filtersOpen}
            aria-controls="catalog-filter-panel"
            onClick={() => setFiltersOpen((isOpen) => !isOpen)}
          >
            <Filter size={15} />
            <span>Filters</span>
            {filterCount ? <span className="catalog-filter-count">{filterCount}</span> : null}
          </button>
          {filtersOpen ? (
            <div id="catalog-filter-panel" className="catalog-filter-panel" role="dialog" aria-label="Catalog filters">
              <div className="catalog-filter-panel-head">
                <strong>Filters</strong>
                <div>
                  {hasFilters ? (
                    <button
                      type="button"
                      className="catalog-filter-clear focus-ring"
                      onClick={() => {
                        setQuery("");
                        setFamily("all");
                        setMode("all");
                        setStatus("all");
                      }}
                    >
                      Clear
                    </button>
                  ) : null}
                  <button type="button" className="catalog-filter-close focus-ring" aria-label="Close filters" onClick={() => setFiltersOpen(false)}>
                    <X size={16} />
                  </button>
                </div>
              </div>
              <label className="catalog-filter-field">
                <span>Family</span>
                <select value={family} onChange={(event) => setFamily(event.target.value as GameFamilyKey | "all")} aria-label="Family filter">
                  <option value="all">{familySelectLabels.all}</option>
                  {gameFamilies.map((item) => (
                    <option key={item.key} value={item.key}>
                      {familySelectLabels[item.key]}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </label>
              <label className="catalog-filter-field">
                <span>Playability</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as PlayabilityStatus | "all")} aria-label="Playability filter">
                  {Object.entries(playabilityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </label>
              <label className="catalog-filter-field">
                <span>Mode</span>
                <select value={mode} onChange={(event) => setMode(event.target.value as CatalogPlayMode | "all")} aria-label="Mode filter">
                  <option value="all">{catalogModeLabels.all}</option>
                  {catalogModeKeys.map((modeKey) => (
                    <option key={modeKey} value={modeKey}>
                      {catalogModeLabels[modeKey]}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </label>
            </div>
          ) : null}
        </div>
        {hasFilters ? (
          <button
            type="button"
            className="catalog-reset focus-ring"
            onClick={() => {
              setQuery("");
              setFamily("all");
              setMode("all");
              setStatus("all");
            }}
          >
            <RotateCcw size={15} />
            Clear
          </button>
        ) : null}
      </div>
      <div className="catalog-count">Showing {filtered.length} of {entries.length} games</div>
      <div className="catalog-grid">
        {filtered.map((entry) => (
          <article key={entry.id} className="panel catalog-card">
            <div className="catalog-card-head">
              <div>
                <h2>{displayGameName(entry)}</h2>
                <p>{gameFamilies.find((item) => item.key === entry.family)?.label}</p>
              </div>
              <button type="button" className="catalog-guide-button focus-ring" aria-label={`Open guide for ${displayGameName(entry)}`} title="Guide, rules, and actions" onClick={() => setSelectedEntry(entry)}>
                <BookOpen size={15} />
                <span>Guide</span>
              </button>
            </div>
            <p className="catalog-card-summary">{entry.shortRules[0] ?? entry.winConditions[0]}</p>
            <CatalogModeStrip entry={entry} />
            <div className="catalog-card-actions">
              {entry.playability === "playable" && entry.variantKey ? (
                <Link href={playGameHref(locale, entry.variantKey, { mode: "offline", time: "rapid" }) as never} className="action-primary focus-ring">
                  <Play size={16} />
                  Play
                </Link>
              ) : (
                <button type="button" className="action-secondary focus-ring" onClick={() => setSelectedEntry(entry)}>
                  <BookOpen size={16} />
                  Guide
                </button>
              )}
              <span className="catalog-status" data-status={entry.playability}>
                {displayPlayabilityStatus(entry.playability)}
              </span>
            </div>
          </article>
        ))}
      </div>
      {selectedEntry ? <CatalogInfoOverlay entry={selectedEntry} locale={locale} onClose={() => setSelectedEntry(null)} /> : null}
      {!filtered.length ? (
        <div className="panel catalog-empty-state">
          <Search size={22} />
          <h2>No matching games</h2>
          <p>Try another family, a native name, a romanized name, or clear the filters.</p>
          <button
            type="button"
            className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2"
            onClick={() => {
              setQuery("");
              setFamily("all");
              setMode("all");
              setStatus("all");
            }}
          >
            <RotateCcw size={15} />
            Show all games
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function CatalogInfoOverlay({ entry, locale, onClose }: { entry: GameCatalogEntry; locale: LocaleCode; onClose: () => void }) {
  const playHref = entry.variantKey ? playGameHref(locale, entry.variantKey, { mode: "offline", time: "rapid" }) : `/${locale}/games/${entry.id}`;

  return (
    <div className="catalog-rules-backdrop" role="presentation" onClick={onClose}>
      <section className="catalog-rules-sheet panel" role="dialog" aria-modal="true" aria-label={`${displayGameName(entry)} guide`} onClick={(event) => event.stopPropagation()}>
        <div className="catalog-rules-head">
          <div>
            <span>{gameFamilies.find((item) => item.key === entry.family)?.label}</span>
            <h2>{displayGameName(entry)}</h2>
          </div>
          <button type="button" className="catalog-icon-button focus-ring" aria-label="Close guide" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="catalog-rules-actions">
          {entry.playability === "playable" && entry.variantKey ? (
            <Link href={playHref as never} className="action-primary focus-ring">
              <Play size={16} />
              Play
            </Link>
          ) : null}
          {entry.playability === "playable" && entry.variantKey ? (
            <Link href={playGameHref(locale, entry.variantKey, { mode: "bot", time: "rapid" }) as never} className="action-secondary focus-ring">
              <Bot size={16} />
              Bot Mode
            </Link>
          ) : null}
          <Link href={`/${locale}/games/${entry.id}` as never} className="action-secondary focus-ring">
            <BookOpen size={16} />
            Full guide
          </Link>
        </div>
        <div className="catalog-guide-sections">
          <details open>
            <summary>Basics</summary>
            <ol>
              {entry.shortRules.slice(0, 4).map((rule, index) => (
                <li key={rule}>
                  <strong>{index + 1}.</strong>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </details>
          <details>
            <summary>How it ends</summary>
            <ul>
              {entry.winConditions.slice(0, 3).map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          </details>
          <details>
            <summary>Status</summary>
            <div className="catalog-card-meta">
              <span>{entry.board.description}</span>
              <span>{displayPiecePresentation(entry)}</span>
              <span>{displayRulesReadiness(entry)}</span>
              <span>{displayReleaseReadiness(entry)}</span>
              <span>{entry.botAdapter !== "none" ? displayBotReadiness(entry) : "Rules only"}</span>
            </div>
          </details>
          <details open>
            <summary>Modes</summary>
            <CatalogModeGrid entry={entry} />
          </details>
          <details>
            <summary>Sources</summary>
            <div className="catalog-source-list">
              {entry.ruleSourceLinks.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="focus-ring action-secondary">
                  {source.name}
                </a>
              ))}
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, "");
}
