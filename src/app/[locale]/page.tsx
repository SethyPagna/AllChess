import Link from "next/link";
import { Bot, Swords } from "lucide-react";

import { IntroBoard } from "@/components/home/intro-board";
import { GameLibrary } from "@/components/home/game-library";
import { getRuntimeCatalogEntries } from "@/lib/catalog/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createPageMetadata } from "@/lib/metadata/page-metadata";
import { playSetupHref } from "@/lib/routing/play-links";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  return createPageMetadata(locale, t("app.tagline"));
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const entries = await getRuntimeCatalogEntries();
  const playableCount = entries.filter((entry) => entry.variantKey).length;

  return (
    <div className="studio-home">
      <section className="studio-hero" aria-label="AllChess intro">
        <div className="intro-copy">
          <h1>Your next <em>move.</em></h1>
          <p>{playableCount} board games to play online, with a bot, or with a friend.</p>
          <div className="intro-actions">
            <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="focus-ring action-primary">
              <Swords size={16} />
              Quick match
            </Link>
            <Link href={playSetupHref(locale, { mode: "bot", time: "rapid" }) as never} className="focus-ring action-secondary">
              <Bot size={16} />
              Play a bot
            </Link>
          </div>
        </div>

        <IntroBoard />
      </section>

      <GameLibrary entries={entries} locale={locale} />
    </div>
  );
}
