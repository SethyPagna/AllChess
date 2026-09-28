"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Bot, Eye, Play, Search, SlidersHorizontal, Swords, Users, X } from "lucide-react";

import { GameArtwork } from "@/components/games/game-artwork";
import { CatalogModeGrid, catalogModeKeys, catalogModeLabels } from "@/components/catalog/catalog-mode-support";
import {
  displayBotReadiness,
  displayGameName,
  displayPiecePresentation,
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
  title?: string;
};

const familyLabels: Record<GameFamilyKey | "all", string> = {
  all: "All",
  "chess-family": "Chess",
  "asian-chess": "Asian",
  draughts: "Checkers",
  mancala: "Mancala",
  "go-family": "Go",
  tables: "Tables",
  tafl: "Tafl",
  race: "Race",
  mill: "Mill",
  regional: "Regional"
};

const modeOptions: Array<{ key: CatalogPlayMode | "all"; label: string }> = [
  { key: "all", label: "All" },
  ...catalogModeKeys.map((key) => ({ key, label: catalogModeLabels[key] }))
];

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

/** Games with a board lead with artwork; rules-only guides sit in one compact list below. */
function hasBoard(entry: GameCatalogEntry) {
  return Boolean(entry.variantKey) && getCatalogModeSupport(entry, "offline").enabled;
}

function gameDetailHref(locale: LocaleCode, entry: GameCatalogEntry, mode: CatalogPlayMode | "all") {
  return `/${locale}/games/${entry.id}${mode === "all" ? "" : `?mode=${mode}`}`;
}

export function CatalogBrowser({ entries, initialFamily = "all", initialMode = "all", initialStatus = "all", locale, title }: CatalogBrowserProps) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<GameFamilyKey | "all">(initialFamily);
  const [mode, setMode] = useState<CatalogPlayMode | "all">(initialMode);
  const [guidesOpen, setGuidesOpen] = useState(initialStatus === "learn" || initialStatus === "coming-soon");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);

  const families = useMemo(
    () => [{ key: "all" as const }, ...gameFamilies.filter((item) => item.key === initialFamily || entries.some((entry) => entry.family === item.key))],
    [entries, initialFamily]
  );
  const normalizedQuery = normalize(query);
  const filtered = useMemo(
    () =>
      entries.filter((entry) => {
        if (family !== "all" && entry.family !== family) return false;
        if (mode !== "all" && !getCatalogModeSupport(entry, mode).enabled) return false;
        if (!normalizedQuery) return true;
        return [entry.id, entry.name.english, entry.name.native, entry.name.romanization, entry.name.short, ...entry.aliases]
          .filter(Boolean)
          .some((value) => normalize(value ?? "").includes(normalizedQuery));
      }),
    [entries, family, mode, normalizedQuery]
  );
  const boards = filtered.filter(hasBoard);
  const guides = filtered.filter((entry) => !hasBoard(entry));
  const guidesForcedOpen = guides.length > 0 && (boards.length === 0 || normalizedQuery !== "");
  const filterCount = mode !== "all" ? 1 : 0;

  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }

  function resetAll() {
    setQuery("");
    setFamily("all");
    setMode("all");
  }

  useEffect(() => {
    if (!filtersOpen) return;

    function closeFilters({ restoreFocus }: { restoreFocus: boolean }) {
      setFiltersOpen(false);
      if (restoreFocus) {
        filterTriggerRef.current?.focus();
      }
    }

    function isOutside(target: EventTarget | null) {
      return target instanceof Node && !filterPopoverRef.current?.contains(target);
    }

    function handlePointerDown(event: PointerEvent) {
      if (isOutside(event.target)) closeFilters({ restoreFocus: false });
    }

    function handleFocusIn(event: FocusEvent) {
      if (isOutside(event.target)) closeFilters({ restoreFocus: false });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFilters({ restoreFocus: true });
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filtersOpen]);

  return (
    <section className="catalog-browser" aria-label={title ? undefined : "Game catalog"}>
      <div className="catalog-head">
        {title ? <h1 className="acct-title">{title}</h1> : null}
        <div className="library-search catalog-search-field">
          <label className="catalog-search-label">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchRef}
              aria-label="Search games"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && query) {
                  event.preventDefault();
                  setQuery("");
                }
              }}
            />
          </label>
          {query ? (
            <button type="button" className="focus-ring" aria-label="Clear search" onClick={clearSearch}>
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div ref={filterPopoverRef} className="catalog-more">
          <button
            ref={filterTriggerRef}
            type="button"
            className="icon-btn focus-ring"
            aria-label={filterCount ? `Filters, ${filterCount} on` : "Filters"}
            title="Filters"
            aria-expanded={filtersOpen}
            aria-controls="catalog-filter-panel"
            data-active={filterCount > 0}
            onClick={() => setFiltersOpen((isOpen) => !isOpen)}
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
          </button>
          {filtersOpen ? (
            <div id="catalog-filter-panel" className="catalog-more-panel popover" aria-label="Catalog filters">
              <OptionGroup label="Mode" value={mode} options={modeOptions} onChange={setMode} />
              {filterCount ? (
                <button type="button" className="acct-link focus-ring" onClick={() => setMode("all")}>
                  Reset filters
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="library-filters catalog-chips" role="group" aria-label="Filter by family">
        {families.map(({ key }) => (
          <button type="button" key={key} className="focus-ring" aria-pressed={family === key} onClick={() => setFamily(key)}>
            {familyLabels[key]}
          </button>
        ))}
      </div>
      <p className="sr-only" role="status">{filtered.length} of {entries.length} games</p>
      {boards.length ? (
        <div className="library-grid catalog-grid-min">
          {boards.map((entry) => (
            <article key={entry.id} className="library-card catalog-card-min">
              <Link href={gameDetailHref(locale, entry, mode) as never} className="library-card-link catalog-art-link focus-ring">
                <GameArtwork variantKey={entry.variantKey} locale={locale} />
                <span className="library-card-copy">
                  <span className="catalog-card-name" title={displayGameName(entry)}>{entry.name.english}</span>
                </span>
                {entry.playability !== "playable" ? <span className="catalog-card-tag">Preview</span> : null}
              </Link>
            </article>
          ))}
        </div>
      ) : null}
      {guides.length ? (
        <details className="catalog-more-games" open={guidesOpen || guidesForcedOpen} onToggle={(event) => setGuidesOpen(event.currentTarget.open)}>
          <summary className="focus-ring">
            Rules only
            <span className="catalog-more-count">{guides.length}</span>
          </summary>
          <ul className="catalog-more-list">
            {guides.map((entry) => (
              <li key={entry.id}>
                <Link href={gameDetailHref(locale, entry, mode) as never} className="focus-ring">
                  <span className="catalog-more-name" title={displayGameName(entry)}>{entry.name.english}</span>
                  <span className="catalog-more-family">{familyLabels[entry.family]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {!filtered.length ? (
        <div className="library-empty">
          <p>No matching games</p>
          <button type="button" className="action-secondary focus-ring" onClick={resetAll}>
            Show all games
          </button>
        </div>
      ) : null}
    </section>
  );
}

function OptionGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ key: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className="catalog-option-group">
      <span>{label}</span>
      <div role="group" aria-label={`${label} filter`}>
        {options.map((option) => (
          <button type="button" key={option.key} className="focus-ring" aria-pressed={value === option.key} onClick={() => onChange(option.key)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
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
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
}
