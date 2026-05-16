import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, test, vi } from "vitest";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { NotificationCenter } from "@/components/notification-center";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/play/classic",
  useSearchParams: () => new URLSearchParams("mode=bot")
}));

describe("shell controls", () => {
  test("language switcher uses an icon trigger and full language names", () => {
    const markup = renderToStaticMarkup(createElement(LocaleSwitcher, { active: "en" }));

    expect(markup).toContain('aria-label="Languages"');
    expect(markup).toContain("English");
    expect(markup).toContain("Français");
    expect(markup).not.toContain(">EN<");
  });

  test("notification center exposes a compact menu with actionable states", () => {
    const markup = renderToStaticMarkup(createElement(NotificationCenter));

    expect(markup).toContain('aria-label="Notifications, 3 unread"');
    expect(markup).toContain("Match ready");
    expect(markup).toContain("Review complete");
    expect(markup).toContain("Real alerts only");
    expect(markup).toContain("Mark read");
  });
});
