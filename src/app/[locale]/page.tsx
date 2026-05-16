import Link from "next/link";
import { Bot, Eye, Library, Play, Radio, Swords, Trophy } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { getCatalogStats, getGameCatalog } from "@/lib/catalog";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createDefaultStats } from "@/lib/stats";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const catalogStats = getCatalogStats(getGameCatalog());
  const siteStats = createDefaultStats();
  const primaryActions = [
    { Icon: Swords, label: "Play", detail: "Choose mode and game", href: `/${locale}/play`, primary: true },
    { Icon: Bot, label: "Bots", detail: "Practice by tier", href: `/${locale}/practice` },
    { Icon: Library, label: "Rules", detail: "Browse game families", href: `/${locale}/variants` },
    { Icon: Eye, label: "Watch", detail: "Real public rooms", href: `/${locale}/watch` }
  ];
  const stats = [
    { Icon: Radio, label: siteStats.playersOnline.label, value: siteStats.playersOnline.value },
    { Icon: Trophy, label: siteStats.activeRooms.label, value: siteStats.activeRooms.value },
    { Icon: Library, label: "Ready games", value: String(catalogStats.playableGames) },
    { Icon: Play, label: "Rule guides", value: String(catalogStats.learnGames + catalogStats.comingSoonGames) }
  ];

  return (
    <div className="home-dashboard grid gap-5">
      <section className="panel home-command-center">
        <div className="home-command-copy">
          <div className="compact-title-row">
            <Swords size={19} />
            <h1>{t("app.name")}</h1>
            <InfoHint text={t("app.tagline")} />
          </div>
          <p>Start a game, train bots, learn a ruleset, or watch public rooms from one compact hub.</p>
        </div>
        <Link href={`/${locale}/play`} className="focus-ring action-primary inline-flex items-center gap-2 px-5 py-3">
          <Swords size={18} />
          Play now
        </Link>
      </section>
      <section className="home-action-grid" aria-label="Home actions">
        {primaryActions.map(({ Icon, detail, href, label, primary }) => (
          <Link key={label} href={href as never} className={`focus-ring home-action-card${primary ? " is-primary" : ""}`}>
            <Icon size={22} />
            <span>{label}</span>
            <small>{detail}</small>
          </Link>
        ))}
      </section>
      <section className="home-stat-grid">
        {stats.map(({ Icon, label, value }) => (
          <div key={label} className="panel home-stat-card">
            <Icon size={17} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <section className="panel home-next-steps">
        <div>
          <h2>Suggested flow</h2>
          <p>New players can start with Classic Chess against a bot, then open Games & rules to branch into Xiangqi, Chess960, Three-check, and other families.</p>
        </div>
        <div className="watch-actions">
          <Link href={`/${locale}/play/classic?bot=normal&mode=bot`} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2">
            <Bot size={16} />
            Classic bot
          </Link>
          <Link href={`/${locale}/variants?playability=learn`} className="action-secondary focus-ring inline-flex items-center gap-2 px-4 py-2">
            <Library size={16} />
            Rule guides
          </Link>
        </div>
      </section>
    </div>
  );
}
