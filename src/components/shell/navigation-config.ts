import type { AppNavGroup } from "@/components/shell/app-navigation";

type Translate = (key: string) => string;

export function createAppNavGroups(t: Translate): AppNavGroup[] {
  return [
    {
      label: t("nav.play"),
      icon: "swords",
      links: [
        { href: "lobby", icon: "home", label: t("nav.lobby") },
        { href: "play", icon: "swords", label: t("nav.play") },
        { href: "variants", icon: "library", label: t("nav.gamesRules") }
      ]
    },
    {
      label: t("nav.watch"),
      icon: "eye",
      links: [
        { href: "watch", icon: "eye", label: t("nav.watchRooms") },
        { href: "leaderboards", icon: "trophy", label: t("nav.leaderboards") }
      ]
    },
    {
      label: t("nav.history"),
      icon: "history",
      links: [{ href: "history", icon: "history", label: t("nav.history") }]
    },
    {
      label: t("nav.settings"),
      icon: "settings",
      links: [{ href: "settings", icon: "settings", label: t("nav.settings") }]
    }
  ];
}
