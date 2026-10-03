import Link from "next/link";
import { Bot, Eye, Globe2, Lock, Play, type LucideIcon } from "lucide-react";

import { GameArtwork } from "@/components/games/game-artwork";
import { FavoriteGameButton } from "@/components/home/favorite-game-button";
import { getCatalogModeSupport, type CatalogPlayMode, type GameCatalogEntry, type GameFamilyKey } from "@/lib/catalog";
import { playGameHref } from "@/lib/routing/play-links";
import { watchHref } from "@/lib/routing/watch-links";

type GameDetailHeroProps = {
  entry: GameCatalogEntry;
  family?: { key: GameFamilyKey; label: string; description: string };
  locale: string;
  mode?: CatalogPlayMode;
};

const heroActions: Record<CatalogPlayMode, { label: string; Icon: LucideIcon }> = {
  offline: { label: "Play", Icon: Play },
  bot: { label: "Play a bot", Icon: Bot },
  online: { label: "Find match", Icon: Globe2 },
  room: { label: "Create room", Icon: Lock },
  spectate: { label: "Watch", Icon: Eye }
};

function actionHref(entry: GameCatalogEntry, locale: string, mode: CatalogPlayMode) {
  return mode === "spectate" ? watchHref(locale, { variant: entry.variantKey }) : playGameHref(locale, entry.variantKey, { mode, time: "rapid" });
}

/** The catalog's chosen mode (else local play) is the primary action, with at most one alternative. */
function heroModes(entry: GameCatalogEntry, requested: CatalogPlayMode | undefined): CatalogPlayMode[] {
  const canUse = (mode: CatalogPlayMode) => getCatalogModeSupport(entry, mode).enabled && (mode === "spectate" || Boolean(entry.variantKey));
  const primary = requested && canUse(requested) ? requested : canUse("offline") ? "offline" : null;
  if (!primary) return [];
  const secondary = primary === "offline" ? (canUse("bot") ? "bot" : null) : canUse("offline") ? "offline" : null;
  return secondary ? [secondary, primary] : [primary];
}

function otherNames(entry: GameCatalogEntry) {
  const seen = new Set([entry.name.english.toLocaleLowerCase()]);
  return [entry.name.romanization, entry.name.native].filter((name): name is string => {
    if (!name || seen.has(name.toLocaleLowerCase())) return false;
    seen.add(name.toLocaleLowerCase());
    return true;
  });
}

export function GameDetailHero({ entry, family, locale, mode }: GameDetailHeroProps) {
  const actions = heroModes(entry, mode);
  const meta = [...otherNames(entry), family?.label, entry.board.description.replace(/\.$/, "")].filter(Boolean).join(" · ");

  return (
    <header className="game-hero">
      {getCatalogModeSupport(entry, "offline").enabled ? <div className="game-hero-art"><GameArtwork variantKey={entry.variantKey} locale={locale} /></div> : null}
      <div className="game-hero-copy">
        <h1>{entry.name.english}</h1>
        <p>{meta}</p>
      </div>
      {actions.length ? (
        <div className="game-hero-actions">
          {/* Starred games lead the home shelf, which lists playable games only. */}
          <FavoriteGameButton gameId={entry.id} />
          {actions.map((actionMode, index) => {
            const { label, Icon } = heroActions[actionMode];
            const primary = index === actions.length - 1;
            return (
              <Link key={actionMode} href={actionHref(entry, locale, actionMode) as never} className={`${primary ? "action-primary" : "action-secondary"} focus-ring`}>
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </header>
  );
}
