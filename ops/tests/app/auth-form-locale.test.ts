import { describe, expect, test } from "vitest";

import { localeFromFormData, localeFromValue } from "@/lib/auth/form-locale";

describe("auth form locale", () => {
  test("keeps supported locale values for auth redirects", () => {
    const formData = new FormData();
    formData.set("locale", "fr");

    expect(localeFromFormData(formData)).toBe("fr");
  });

  test("falls back to English for missing or unsupported locale values", () => {
    const malicious = new FormData();
    malicious.set("locale", "../admin");

    expect(localeFromFormData(new FormData())).toBe("en");
    expect(localeFromFormData(malicious)).toBe("en");
    expect(localeFromValue("not-a-locale")).toBe("en");
    expect(localeFromValue(null)).toBe("en");
  });
});
