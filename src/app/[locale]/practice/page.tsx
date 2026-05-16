import { redirect } from "next/navigation";

import { normalizeLocale } from "@/lib/i18n/locales";

export default async function PracticePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  redirect(`/${locale}/variants?playability=playable`);
}
