import Link from "next/link";

import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

const demoRecords = [
  { id: "classic", white: "Sethy", black: "Codex", result: "1-0", moves: 42 },
  { id: "xiangqi", white: "Red Lotus", black: "River Guard", result: "0-1", moves: 67 },
  { id: "shogi", white: "Sente", black: "Gote", result: "draw", moves: 112 }
];

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-4xl font-black">{t("history.title")}</h1>
        <p className="mt-2 text-[var(--muted)]">{t("history.subtitle")}</p>
      </div>
      <div className="panel overflow-hidden">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--surface-strong)] text-[var(--muted)]">
            <tr>
              <th className="p-4">Game</th>
              <th className="p-4">Players</th>
              <th className="p-4">Result</th>
              <th className="p-4">Moves</th>
              <th className="p-4">Replay</th>
            </tr>
          </thead>
          <tbody>
            {demoRecords.map((record) => (
              <tr key={record.id} className="border-t border-[var(--border)]">
                <td className="p-4 font-bold">{record.id}</td>
                <td className="p-4">{record.white} vs {record.black}</td>
                <td className="p-4">{record.result}</td>
                <td className="p-4">{record.moves}</td>
                <td className="p-4">
                  <Link className="font-bold text-[var(--accent-strong)]" href={`/${locale}/play/${record.id}`}>
                    {t("chess.replay")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
