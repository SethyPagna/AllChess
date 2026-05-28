import { describe, expect, test } from "vitest";

import { createTranslator, dictionaryKeys, getDictionary, missingKeys } from "@/lib/i18n/dictionary";
import { localeNames, locales, normalizeLocale, rtlLocales } from "@/lib/i18n/locales";
import { getVocabulary } from "@/lib/i18n/vocabulary";

describe("i18n dictionaries", () => {
  test("keeps every launch locale readable through English fallback", () => {
    for (const locale of locales) {
      const dictionary = getDictionary(locale);
      for (const key of dictionaryKeys()) {
        expect(dictionary[key], `${locale}:${key}`).toBeTruthy();
      }
      expect(missingKeys(locale)).toEqual([]);
    }
  });

  test("translates known keys and returns unknown keys for diagnostics", () => {
    const t = createTranslator("es");

    expect(t("nav.lobby")).toBe("Sala");
    expect(t("missing.key")).toBe("missing.key");
  });

  test("normalizes unsupported locales to English", () => {
    expect(normalizeLocale("not-real")).toBe("en");
    expect(normalizeLocale("km")).toBe("km");
  });

  test("defines visible language names and RTL metadata", () => {
    expect(localeNames.ar).toBe("العربية");
    expect(localeNames.fr).toBe("Français");
    expect(localeNames["zh-CN"]).toBe("简体中文");
    expect(rtlLocales.has("ar")).toBe(true);
    expect(rtlLocales.has("en")).toBe(false);
  });

  test("provides reusable chess vocabulary domains", () => {
    const vocabulary = getVocabulary("zh-CN");

    expect(vocabulary.pieces.king).toBe("王");
    expect(vocabulary.analysis.blunder).toBe("Blunder");
    expect(vocabulary.accessibility.board).toBe("Game board");
  });
});
