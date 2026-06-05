import type { Metadata } from "next";

import { createTranslator } from "@/lib/i18n/dictionary";
import type { LocaleCode } from "@/lib/i18n/locales";

export function createPageMetadata(locale: LocaleCode, pageTitle: string, description?: string): Metadata {
  const t = createTranslator(locale);
  return {
    title: `${t("app.name")} - ${pageTitle}`,
    description: description ?? t("app.description")
  };
}
