import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfileResults } from "@/components/profile/profile-results";
import { ProfileStats } from "@/components/profile/profile-stats";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createPageMetadata } from "@/lib/metadata/page-metadata";
import { getRuntimeProfileHistory } from "@/lib/profile/runtime";
import { summarizeProfileHistory } from "@/lib/profile/summary";

export const dynamic = "force-dynamic";

const guestUsername = "player";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; username: string }> }) {
  const { locale: rawLocale, username } = await params;
  const locale = normalizeLocale(rawLocale);
  const displayName = username === guestUsername ? "Guest player" : username;
  return createPageMetadata(locale, `${displayName} profile`, "Profile, match records, and rating summary.");
}

export default async function ProfilePage({
  params
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale: rawLocale, username } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const isGuest = username === guestUsername;
  const history = await getRuntimeProfileHistory(username, 5);
  const summary = summarizeProfileHistory(history);
  const hasRecords = summary.gamesPlayed > 0 || history.results.length > 0;

  return (
    <section className="profile-page">
      <ProfileHero
        displayName={isGuest ? "Guest player" : username}
        isGuest={isGuest}
        locale={locale}
        settingsLabel={t("nav.settings")}
        signInLabel={isGuest ? t("nav.login") : null}
      />
      {hasRecords ? <ProfileStats ratingLabel={t("chess.rating")} summary={summary} /> : null}
      <ProfileResults history={history} locale={locale} />
    </section>
  );
}
