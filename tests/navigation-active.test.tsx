import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { AppMobileNavigation, AppSidebarNavigation, type AppNavGroup } from "@/components/app-navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/play/classic"
}));

const groups: AppNavGroup[] = [
  {
    icon: "swords",
    label: "Play",
    links: [
      { href: "lobby", icon: "home", label: "Lobby" },
      { href: "play", icon: "swords", label: "Play" }
    ]
  },
  {
    icon: "settings",
    label: "Account",
    links: [
      { href: "profile/player", icon: "user", label: "Profile" },
      { href: "history", icon: "history", label: "History" },
      { href: "settings", icon: "settings", label: "Settings" }
    ]
  }
];

describe("app navigation", () => {
  test("marks the active route and parent group in the sidebar", () => {
    const markup = renderToStaticMarkup(createElement(AppSidebarNavigation, { groups, locale: "en" }));

    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('class="app-nav-group is-active"');
    expect(markup).toContain('class="app-nav-group-summary focus-ring is-active"');
  });

  test("keeps mobile navigation grouped instead of one long undifferentiated list", () => {
    const markup = renderToStaticMarkup(createElement(AppMobileNavigation, { groups, locale: "en" }));

    expect(markup).toContain("app-menu-section-label");
    expect(markup).toContain(">Play<");
    expect(markup).toContain(">Account<");
  });

  test("keeps profile and history under account instead of community", () => {
    const markup = renderToStaticMarkup(createElement(AppSidebarNavigation, { groups, locale: "en" }));

    expect(markup).toContain(">Profile<");
    expect(markup).toContain(">History<");
    expect(markup).not.toContain(">Community<");
  });
});
