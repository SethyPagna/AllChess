import Link from "next/link";
import { Bot, Library, Swords, Trophy } from "lucide-react";

import { playGameHref, playSetupHref } from "@/lib/routing/play-links";

type LobbyActionsProps = {
  locale: string;
};

export function LobbyActions({ locale }: LobbyActionsProps) {
  return (
    <div className="panel lobby-action-row">
      <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="focus-ring action-primary lobby-action-button">
        <Swords size={16} />
        Play now
      </Link>
      <Link href={playGameHref(locale, "classic", { mode: "bot", time: "rapid" }) as never} className="focus-ring action-secondary lobby-action-button">
        <Bot size={16} />
        Bot training
      </Link>
      <Link href={`/${locale}/variants`} className="focus-ring action-secondary lobby-action-button">
        <Library size={16} />
        Games & rules
      </Link>
      <Link href={`/${locale}/leaderboards` as never} className="focus-ring action-secondary lobby-action-button">
        <Trophy size={16} />
        Leaderboards
      </Link>
    </div>
  );
}
