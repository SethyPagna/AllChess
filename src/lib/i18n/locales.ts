export const locales = [
  "en",
  "km",
  "zh-CN",
  "zh-TW",
  "vi",
  "th",
  "ru",
  "fr",
  "es",
  "de",
  "ja",
  "ko",
  "pt",
  "it",
  "ar",
  "hi",
  "id",
  "ms",
  "tr"
] as const;

export type LocaleCode = (typeof locales)[number];

export const defaultLocale: LocaleCode = "en";

export const rtlLocales = new Set<LocaleCode>(["ar"]);

export const localeNames: Record<LocaleCode, string> = {
  en: "English",
  km: "ភាសាខ្មែរ",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  vi: "Tiếng Việt",
  th: "ไทย",
  ru: "Русский",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  ja: "日本語",
  ko: "한국어",
  pt: "Português",
  it: "Italiano",
  ar: "العربية",
  hi: "हिन्दी",
  id: "Indonesia",
  ms: "Melayu",
  tr: "Türkçe"
};

export function isLocale(value: string | undefined): value is LocaleCode {
  return locales.includes(value as LocaleCode);
}

export function normalizeLocale(value: string | undefined): LocaleCode {
  return isLocale(value) ? value : defaultLocale;
}
