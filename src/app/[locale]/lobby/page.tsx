import Link from "next/link";
import { Bot, Clock, Eye, Lock, Radio, Swords, Users } from "lucide-react";

import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createDefaultStats } from "@/lib/stats";
import { variantCatalog } from "@/lib/variants";

export default async function LobbyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const featured = variantCatalog.slice(0, 6);
  const siteStats = createDefaultStats();
  const lobbyActions = [
    { Icon: Swords, title: t("lobby.quickPair"), body: "Find an even opponent by rating and preferred time control." },
    { Icon: Lock, title: t("lobby.privateRoom"), body: "Create a shareable room code for friends." },
    { Icon: Clock, title: t("lobby.correspondence"), body: "Play long-form games across time zones." },
    { Icon: Eye, title: "Watch live", body: "Spectate public rooms with read-only board, clocks, and move list." },
    { Icon: Bot, title: t("lobby.aiPractice"), body: "Practice against Easy through Legend bot levels." },
    { Icon: Users, title: "Live presence", body: `${siteStats.playersOnline.value} online · ${siteStats.activeRooms.value} rooms · ${siteStats.spectators.value} spectators.` }
  ];

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <div>
          <h1 className="text-4xl font-black sm:text-5xl">{t("lobby.title")}</h1>
          <p className="mt-2 text-[var(--muted)]">{t("app.description")}</p>
        </div>
        <div className="panel flex flex-wrap gap-2 p-3">
          <Link href={`/${locale}/play/classic`} className="focus-ring action-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Swords size={16} />
            Play now
          </Link>
          <Link href={`/${locale}/play/classic?bot=normal`} className="focus-ring action-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Bot size={16} />
            Bot practice
          </Link>
          <Link href={`/${locale}/lobby?watch=live`} className="focus-ring action-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Eye size={16} />
            Watch live
          </Link>
          <Link href={`/${locale}/variants`} className="focus-ring action-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Radio size={16} />
            Browse rules
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {featured.map((variant) => (
            <Link key={variant.key} href={`/${locale}/play/${variant.key}`} className="panel focus-ring grid gap-2 p-4 transition hover:border-[var(--accent)]">
              <span className="flex items-center justify-between gap-3 text-lg font-black">
                {t(variant.nameKey)}
                <span className="rounded-md bg-[var(--surface-soft)] px-2 py-1 text-xs font-bold text-[var(--muted)]">{variant.rulesAdapter}</span>
              </span>
              <span className="text-sm text-[var(--muted)]">{variant.objective}</span>
            </Link>
          ))}
        </div>
      </div>
      <aside className="panel grid content-start gap-4 p-5">
        {lobbyActions.map(({ Icon, title, body }) => (
          <div key={title} className="rounded-md bg-[var(--surface-strong)] p-4">
            <h2 className="flex items-center gap-2 font-bold">
              <Icon size={16} className="text-[var(--accent)]" />
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
          </div>
        ))}
      </aside>
    </section>
  );
}
