import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function ProfilePage({
  params
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale: rawLocale, username } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);

  return (
    <section className="mx-auto grid max-w-4xl gap-6">
      <div className="panel flex flex-wrap items-center gap-5 p-5">
        <div className="grid h-20 w-20 place-items-center rounded-lg bg-[var(--accent)] text-2xl font-black text-black">
          {username.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-4xl font-black">@{username}</h1>
          <p className="text-[var(--muted)]">{t("chess.rating")}: 1200</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {["classic", "xiangqi", "shogi"].map((variant) => (
          <div key={variant} className="panel p-4">
            <p className="text-sm text-[var(--muted)]">{variant}</p>
            <p className="text-3xl font-black">12-4-2</p>
          </div>
        ))}
      </div>
    </section>
  );
}
