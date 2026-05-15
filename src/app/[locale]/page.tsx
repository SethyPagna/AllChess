import Link from "next/link";
import { Bot, Globe2, Sparkles, Trophy } from "lucide-react";

import { GameBoard } from "@/components/game-board";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createDefaultStats } from "@/lib/stats";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const proofPoints = [
    { Icon: Bot, label: "Grandmaster and Legend bots" },
    { Icon: Globe2, label: "Global variants" },
    { Icon: Sparkles, label: "Review-ready games" }
  ];
  const siteStats = createDefaultStats();
  const stats = [
    { Icon: Trophy, label: siteStats.playersOnline.label, value: siteStats.playersOnline.value },
    { Icon: Globe2, label: siteStats.activeRooms.label, value: siteStats.activeRooms.value },
    { Icon: Sparkles, label: siteStats.spectators.label, value: siteStats.spectators.value },
    { Icon: Bot, label: siteStats.bots.label, value: siteStats.bots.value }
  ];

  return (
    <div className="grid gap-7">
      <section className="grid min-w-0 items-center gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="space-y-6">
          <h1 className="max-w-3xl text-5xl font-black leading-tight sm:text-7xl">{t("app.name")}</h1>
          <p className="max-w-2xl text-xl leading-9 text-[var(--muted)]">{t("app.tagline")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${locale}/lobby`} className="focus-ring action-primary inline-flex px-5 py-3">
              {t("lobby.quickPair")}
            </Link>
            <Link href={`/${locale}/variants`} className="focus-ring action-secondary inline-flex px-5 py-3">
              {t("nav.variants")}
            </Link>
          </div>
          <div className="grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-3">
            {proofPoints.map(({ Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-2 rounded-md bg-[var(--surface-soft)] px-3 py-2">
                <Icon size={16} className="text-[var(--accent)]" />
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="home-board-preview glass min-w-0 rounded-lg p-3">
          <GameBoard variantKey="classic" />
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        {stats.map(({ Icon, label, value }) => (
          <div key={label} className="panel p-4">
            <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Icon size={16} className="text-[var(--accent)]" />
              {label}
            </p>
            <p className="text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
