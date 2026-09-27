"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Bot, Eye, Filter, Play, RotateCcw, Search, Swords, Users, X } from "lucide-react";

import { ChoicePicker } from "@/components/board/choice-buttons";
import { GameArtwork } from "@/components/games/game-artwork";
import { CatalogModeGrid, catalogModeKeys, catalogModeLabels } from "@/components/catalog/catalog-mode-support";
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
import { watchHref } from "@/lib/routing/watch-links";

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

const primaryActions = {
  online: { label: "Find match", Icon: Swords, describe: (name: string) => `Find an online match for ${name}` },
  bot: { label: "Play bot", Icon: Bot, describe: (name: string) => `Play ${name} against a bot` },
  offline: { label: "Play local", Icon: Play, describe: (name: string) => `Play ${name} locally` },
  room: { label: "Play friend", Icon: Users, describe: (name: string) => `Play ${name} with a friend` },
  spectate: { label: "Watch", Icon: Eye, describe: (name: string) => `Watch ${name}` }
};

function catalogPrimaryAction(entry: GameCatalogEntry, locale: LocaleCode, selectedMode: CatalogPlayMode | "all") {
  const mode = selectedMode === "all" ? "offline" : selectedMode;
  if (!getCatalogModeSupport(entry, mode).enabled || (mode !== "spectate" && !entry.variantKey)) return null;
  const action = primaryActions[mode];
  return {
    ...action,
    mode,
    href: mode === "spectate" ? watchHref(locale, { variant: entry.variantKey }) : playGameHref(locale, entry.variantKey, { mode, time: "rapid" }),
    accessibleLabel: mode === "spectate" && !entry.variantKey ? "Browse public rooms" : action.describe(displayGameName(entry))
  };
}

export function CatalogBrowser({ entries, initialFamily = "all", initialMode = "all", initialStatus = "all", locale }: CatalogBrowserProps) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<GameFamilyKey | "all">(initialFamily);
  const [mode, setMode] = useState<CatalogPlayMode | "all">(initialMode);
  const [status, setStatus] = useState<PlayabilityStatus | "all">(initialStatus);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GameCatalogEntry | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!filtersOpen) return;

    function closeFilters({ restoreFocus }: { restoreFocus: boolean }) {
      setFiltersOpen(false);
      if (restoreFocus) {
        filterTriggerRef.current?.focus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !filterPopoverRef.current?.contains(target)) {
        closeFilters({ restoreFocus: false });
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFilters({ restoreFocus: true });
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filtersOpen]);

  return (
    <section className="catalog-browser">
      <div className="catalog-toolbar panel">
        <label className="catalog-search focus-within:ring-2 focus-within:ring-[var(--accent)]">
          <Search size={18} />
          <span className="sr-only">Search games</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games" />
        </label>
        <div ref={filterPopoverRef} className={`catalog-filter-popover${filtersOpen ? " is-open" : ""}`}>
          <button
            ref={filterTriggerRef}
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
            <div id="catalog-filter-panel" className="catalog-filter-panel" role="dialog" aria-modal="false" aria-label="Catalog filters">
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
              <ChoicePicker<GameFamilyKey | "all"> label="Family filter" value={family} onChange={setFamily} options={[{ key: "all", label: familySelectLabels.all }, ...gameFamilies.map(item => ({ key: item.key, label: familySelectLabels[item.key] }))]} />
              <ChoicePicker<PlayabilityStatus | "all"> label="Playability filter" value={status} onChange={setStatus} options={(Object.entries(playabilityLabels) as [PlayabilityStatus | "all", string][]).map(([key, label]) => ({ key, label }))} />
              <ChoicePicker<CatalogPlayMode | "all"> label="Mode filter" value={mode} onChange={setMode} options={[{ key: "all", label: catalogModeLabels.all }, ...catalogModeKeys.map(key => ({ key, label: catalogModeLabels[key] }))]} />
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
      <div className="catalog-count" role="status">{filtered.length} of {entries.length} games</div>
      <div className="catalog-grid">
        {filtered.map((entry) => {
          const action = catalogPrimaryAction(entry, locale, mode);
          return (
          <article key={entry.id} className="panel catalog-card visual-catalog-card">
            {action ? <Link href={action.href as never} className="catalog-art-link focus-ring" aria-label={action.accessibleLabel}><GameArtwork variantKey={entry.variantKey} locale={locale} /></Link> : <button type="button" className="catalog-art-link focus-ring" aria-label={`Read ${displayGameName(entry)} guide`} onClick={() => setSelectedEntry(entry)}><GameArtwork locale={locale} /></button>}
            <div className="catalog-card-head">
              <div>
                <h2>{entry.name.english}</h2>
              </div>
              <button type="button" className="catalog-guide-button focus-ring" aria-label={`Open guide for ${displayGameName(entry)}`} title="Guide, rules, and actions" onClick={() => setSelectedEntry(entry)}>
                <BookOpen size={15} />
                <span className="sr-only">Guide</span>
              </button>
            </div>
            <div className="catalog-card-actions">
              {action ? (
                <Link href={action.href as never} className="action-primary focus-ring" aria-label={action.accessibleLabel}>
                  <action.Icon size={16} aria-hidden="true" />
                  {action.label}
                </Link>
              ) : (
                <button type="button" className="action-secondary focus-ring" onClick={() => setSelectedEntry(entry)}>
                  <BookOpen size={16} />
                  Guide
                </button>
              )}
              <span className="catalog-status" data-status={entry.playability}>
                {getCatalogModeSupport(entry, "offline").level === "preview" ? "Preview" : displayPlayabilityStatus(entry.playability)}
              </span>
            </div>
          </article>
          );
        })}
      </div>
      {selectedEntry ? <CatalogInfoOverlay entry={selectedEntry} locale={locale} mode={mode} onClose={() => setSelectedEntry(null)} /> : null}
      {!filtered.length ? (
        <div className="panel catalog-empty-state">
          <Search size={22} />
          <h2>No matching games</h2>
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

export function CatalogInfoOverlay({ entry, locale, mode = "all", onClose }: { entry: GameCatalogEntry; locale: LocaleCode; mode?: CatalogPlayMode | "all"; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const action = catalogPrimaryAction(entry, locale, mode);
  const botAction = action?.mode !== "bot" ? catalogPrimaryAction(entry, locale, "bot") : null;

  return (
    <dialog ref={dialogRef} className="catalog-rules-dialog" aria-label={`${displayGameName(entry)} guide`} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="catalog-rules-sheet panel">
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
          {action ? (
            <Link href={action.href as never} className="action-primary focus-ring" aria-label={action.accessibleLabel}>
              <action.Icon size={16} aria-hidden="true" />
              {action.label}
            </Link>
          ) : null}
          {botAction ? (
            <Link href={botAction.href as never} className="action-secondary focus-ring" aria-label={botAction.accessibleLabel}>
              <Bot size={16} aria-hidden="true" />
              {botAction.label}
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
            <ol className="catalog-guide-list">
              {entry.shortRules.slice(0, 4).map((rule, index) => (
                <li key={rule}>
                  <strong>{index + 1}</strong>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </details>
          <details>
            <summary>How it ends</summary>
            <ul className="catalog-guide-list catalog-guide-list-plain">
              {entry.winConditions.slice(0, 3).map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          </details>
          <details>
            <summary>Status</summary>
            <div className="catalog-guide-status-grid">
              <span>{entry.board.description}</span>
              <span>{displayPiecePresentation(entry)}</span>
              <span>{displayRulesReadiness(entry)}</span>
              <span>{displayReleaseReadiness(entry)}</span>
              <span>{entry.botAdapter !== "none" ? displayBotReadiness(entry) : "Rules only"}</span>
            </div>
          </details>
          <details>
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
    </dialog>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
}
