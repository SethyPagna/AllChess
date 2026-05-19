import { normalizeLocale } from "@/lib/i18n/locales";

export function localeFromFormData(formData: Pick<FormData, "get">) {
  return localeFromValue(formData.get("locale"));
}

export function localeFromValue(value: FormDataEntryValue | string | null | undefined) {
  return normalizeLocale(typeof value === "string" ? value : undefined);
}
