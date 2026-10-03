import type { AppNavItem } from "@/components/shell/app-navigation";

type Translate = (key: string) => string;

export function createAppNavItems(t: Translate): AppNavItem[] {
  return [
    { href: "", icon: "home", label: t("nav.home") },
    { href: "play", icon: "swords", label: t("nav.play") },
    { href: "variants", icon: "library", label: t("nav.variants"), alsoActiveOn: ["games"] },
    { href: "watch", icon: "eye", label: t("nav.watch") },
    { href: "history", icon: "history", label: t("nav.history"), alsoActiveOn: ["analysis"] }
  ];
}

export function createAppSecondaryItems(t: Translate): AppNavItem[] {
  return [
    { href: "leaderboards", icon: "trophy", label: t("nav.leaderboards") },
    { href: "profile/player", icon: "user", label: t("nav.profile") },
    { href: "settings", icon: "settings", label: t("nav.settings") }
  ];
}
