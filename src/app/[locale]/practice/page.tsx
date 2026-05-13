import Link from "next/link";
import { Bot, Brain, Play, Swords } from "lucide-react";

import { displayGameName, gameFamilies, getGameCatalog } from "@/lib/catalog";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function PracticePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const playable = getGameCatalog().filter((entry) => entry.playability === "playable" && entry.variantKey);

  return (
    <section className="practice-page grid gap-5">
      <div className="practice-hero panel">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">
            <Bot size={16} />
            Bot practice
          </p>
          <h1>Choose a game, then train</h1>
          <p>Pick the board first. The play screen opens with bot opponent on, random side enabled, and difficulty available during the game.</p>
        </div>
        <Link href={`/${locale}/play/classic?bot=normal`} className="focus-ring action-primary inline-flex items-center gap-2 px-4 py-3">
          <Play size={18} />
          Quick chess bot
        </Link>
      </div>
      <div className="practice-grid">
        {playable.map((entry) => (
          <article key={entry.id} className="panel practice-card">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">{gameFamilies.find((family) => family.key === entry.family)?.label}</p>
              <h2>{displayGameName(entry)}</h2>
              <p>{entry.board.description}</p>
            </div>
            <div className="practice-card-meta">
              <span>
                <Swords size={15} />
                {entry.rulesAdapter}
              </span>
              <span>
                <Brain size={15} />
                {entry.botAdapter}
              </span>
            </div>
            <Link href={`/${locale}/play/${entry.variantKey}?bot=normal`} className="focus-ring action-secondary inline-flex items-center justify-center gap-2 px-3 py-2 text-sm">
              <Bot size={16} />
              Practice
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
