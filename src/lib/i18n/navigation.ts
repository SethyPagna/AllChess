import { locales, type LocaleCode } from "./locales";

export function localizePath(path: string, nextLocale: LocaleCode) {
  const [pathname, query = ""] = path.split("?");
  const segments = pathname.split("/").filter(Boolean);
  const [, ...rest] = locales.includes(segments[0] as LocaleCode) ? segments : ["", ...segments];
  const localized = `/${[nextLocale, ...rest].join("/")}`;
  return query ? `${localized}?${query}` : localized;
}
