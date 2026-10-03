import { redirect } from "next/navigation";

import { normalizeLocale } from "@/lib/i18n/locales";

/** The lobby merged into Home, which has the same play actions and featured games and a nav item. */
export default async function LegacyLobbyRedirectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  redirect(`/${normalizeLocale(rawLocale)}`);
}
