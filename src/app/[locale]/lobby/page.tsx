import Link from "next/link";

import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { variantCatalog } from "@/lib/variants";

export default async function LobbyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const featured = variantCatalog.slice(0, 6);

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div>
          <h1 className="text-4xl font-black sm:text-5xl">{t("lobby.title")}</h1>
          <p className="mt-2 text-[var(--muted)]">{t("app.description")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {featured.map((variant) => (
            <Link key={variant.key} href={`/${locale}/play/${variant.key}`} className="panel focus-ring grid gap-2 p-4 transition hover:border-[var(--accent)]">
              <span className="text-lg font-black">{t(variant.nameKey)}</span>
              <span className="text-sm text-[var(--muted)]">{variant.objective}</span>
            </Link>
          ))}
        </div>
      </div>
      <aside className="panel grid content-start gap-4 p-5">
        {[
          [t("lobby.quickPair"), "Find an even opponent by rating and preferred time control."],
          [t("lobby.privateRoom"), "Create a shareable room code for friends."],
          [t("lobby.correspondence"), "Play long-form games across time zones."],
          [t("lobby.aiPractice"), "Practice against analysis-guided AI lines."]
        ].map(([title, body]) => (
          <div key={title} className="rounded-md bg-[var(--surface-strong)] p-4">
            <h2 className="font-bold">{title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
          </div>
        ))}
      </aside>
    </section>
  );
}
