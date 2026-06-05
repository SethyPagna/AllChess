import { redirect } from "next/navigation";

import { normalizeLocale } from "@/lib/i18n/locales";
import { createPageMetadata } from "@/lib/metadata/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  return createPageMetadata(locale, "Bot training");
}

export default async function LegacyPracticeRedirectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  redirect(`/${locale}/variants?playability=playable`);
}
