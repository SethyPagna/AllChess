import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function AnalysisPage({
  params
}: {
  params: Promise<{ locale: string; gameId: string }>;
}) {
  const { locale: rawLocale, gameId } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);

  return (
    <section className="mx-auto grid max-w-4xl gap-6">
      <div>
        <h1 className="text-4xl font-black">{t("analysis.title")}</h1>
        <p className="mt-2 text-[var(--muted)]">{t("analysis.subtitle")}</p>
      </div>
      <div className="panel grid gap-4 p-5">
        <p className="font-mono text-sm text-[var(--muted)]">Game: {gameId}</p>
        <div className="rounded-md bg-[var(--surface-strong)] p-4">
          <h2 className="font-bold">Model-ready report</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            The AI route summarizes move history, highlights turning points, and stores structured reports in Cloudflare D1
            when `OPENAI_API_KEY` is configured.
          </p>
        </div>
      </div>
    </section>
  );
}
