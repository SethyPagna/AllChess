import Link from "next/link";
import { Bot, Clock, Eye, Lock, Swords, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";
import type { SiteStat } from "@/lib/realtime/stats";
import { playSetupHref } from "@/lib/routing/play-links";

type LobbyActivityProps = {
  locale: string;
  siteStats: {
    activeRooms: SiteStat;
    playersOnline: SiteStat;
    spectators: SiteStat;
  };
  t: (key: string) => string;
};

type LobbyAction = {
  Icon: LucideIcon;
  body: string;
  href: string;
  title: string;
};

export function LobbyActivity({ locale, siteStats, t }: LobbyActivityProps) {
  const lobbyActions: LobbyAction[] = [
    { Icon: Swords, title: t("lobby.quickPair"), href: playSetupHref(locale, { mode: "online", time: "rapid" }), body: "Find an even opponent by rating and preferred time control." },
    { Icon: Lock, title: t("lobby.privateRoom"), href: playSetupHref(locale, { mode: "room", time: "rapid" }), body: "Create a shareable room code for friends." },
    { Icon: Clock, title: t("lobby.correspondence"), href: playSetupHref(locale, { mode: "online", time: "correspondence" }), body: "Play long-form games across time zones." },
    { Icon: Eye, title: "Watch rooms", href: `/${locale}/watch`, body: "Spectate public rooms when real games are active." },
    { Icon: Bot, title: t("lobby.aiPractice"), href: playSetupHref(locale, { mode: "bot", time: "rapid" }), body: "Choose a verified board, then train against Easy through Legend bot levels." },
    { Icon: Users, title: "Presence", href: `/${locale}/watch`, body: `${siteStats.playersOnline.value} online / ${siteStats.activeRooms.value} rooms / ${siteStats.spectators.value} spectators.` }
  ];

  return (
    <aside className="panel grid content-start gap-4 p-5">
      <div className="compact-section-heading">
        <h2 className="section-title">Rooms & Activity</h2>
        <InfoHint text="Every row opens the matching flow; room and presence counts stay empty until Cloudflare reports real activity." />
      </div>
      {lobbyActions.map(({ Icon, title, href, body }) => (
        <div key={title} className="lobby-tool-row rounded-md bg-[var(--surface-strong)] p-3">
          <Link href={href as never} className="focus-ring lobby-tool-link">
            <span>
              <Icon size={16} className="text-[var(--accent)]" />
              {title}
            </span>
            <span aria-hidden="true">Open</span>
          </Link>
          <div className="lobby-tool-info">
            <InfoHint text={body} />
          </div>
        </div>
      ))}
    </aside>
  );
}
