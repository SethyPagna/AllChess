import { ProfileEmptyState } from "@/components/profile/profile-empty-state";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfileResults } from "@/components/profile/profile-results";
import { ProfileStats } from "@/components/profile/profile-stats";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getRuntimeProfileHistory } from "@/lib/profile/runtime";
import { summarizeProfileHistory } from "@/lib/profile/summary";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale: rawLocale, username } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const displayName = username === "player" ? "Guest player" : username;
  const history = await getRuntimeProfileHistory(username, 5);
  const summary = summarizeProfileHistory(history);

  return (
    <section className="account-page mx-auto grid max-w-5xl gap-5">
      <ProfileHero displayName={displayName} history={history} locale={locale} summary={summary} />
      <ProfileStats ratingLabel={t("chess.rating")} summary={summary} />
      {history.results.length > 0 ? <ProfileResults history={history} locale={locale} /> : <ProfileEmptyState locale={locale} />}
    </section>
  );
}
