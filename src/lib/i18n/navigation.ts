import { locales, type LocaleCode } from "./locales";

export function localizePath(path: string, nextLocale: LocaleCode) {
  const { pathname, query, hash } = splitPath(path);
  const segments = pathname.split("/").filter(Boolean);
  const [, ...rest] = locales.includes(segments[0] as LocaleCode) ? segments : ["", ...segments];
  const localized = `/${[nextLocale, ...rest].join("/")}`;
  return `${localized}${query}${hash}`;
}

function splitPath(path: string) {
  const hashIndex = path.indexOf("#");
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const queryIndex = withoutHash.indexOf("?");
  const rawPathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const pathname = rawPathname.startsWith("/") ? rawPathname : `/${rawPathname}`;

  return { pathname, query, hash };
}
