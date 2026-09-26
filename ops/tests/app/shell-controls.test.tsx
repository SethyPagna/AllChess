import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, test, vi } from "vitest";

import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { NotificationCenter } from "@/components/shell/notification-center";
import { InfoHint } from "@/components/ui/info-hint";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/play/classic",
  useSearchParams: () => new URLSearchParams("mode=bot")
}));

describe("shell controls", () => {
  test("language switcher uses an icon trigger and full language names", () => {
    const markup = renderToStaticMarkup(createElement(LocaleSwitcher, { active: "en" }));

    expect(markup).toContain('aria-label="Languages"');
    expect(markup).toContain('data-shell-menu="language"');
    expect(markup).toContain("shell-icon-control");
    expect(markup).toContain("English");
    expect(markup).toContain("Français");
    expect(markup).toContain("简体中文");
    expect(markup).not.toContain(">EN<");
  });

  test("notification center does not count placeholder messages as real unread events", () => {
    const markup = renderToStaticMarkup(createElement(NotificationCenter));

    expect(markup).toContain('aria-label="Notifications"');
    expect(markup).toContain('data-shell-menu="notifications"');
    expect(markup).toContain("shell-icon-control");
    expect(markup).toContain("No notifications yet");
    expect(markup).not.toContain("unread");
    expect(markup).not.toContain("Match ready");
    expect(markup).not.toContain("notification-dot");
    expect(markup).not.toContain("Mark read");
  });

  test("information hints are native expandable controls", () => {
    const markup = renderToStaticMarkup(createElement(InfoHint, { text: "Short extra context." }));

    expect(markup).toContain("<details");
    expect(markup).toContain("<summary");
    expect(markup).toContain('aria-label="More information"');
    expect(markup).toContain('title="More information"');
    expect(markup).toContain("Short extra context.");
  });
});
