import Link from "next/link";
import { Bot, Eye, Library, Play } from "lucide-react";

import { playSetupHref } from "@/lib/routing/play-links";

type IntroNavigationProps = {
  locale: string;
};

export function IntroNavigation({ locale }: IntroNavigationProps) {
  const workflows = [
    { Icon: Play, label: "Pick a board", detail: "Chess, variants, and rules in one place.", href: playSetupHref(locale, { mode: "online", time: "rapid" }) },
    { Icon: Bot, label: "Train fast", detail: "Bots explain source, tier, and threat.", href: playSetupHref(locale, { mode: "bot", time: "rapid" }) },
    { Icon: Eye, label: "Watch or review", detail: "Rooms, history, and analysis stay connected.", href: `/${locale}/watch` }
  ];

  return (
    <>
      <section className="intro-workflow" aria-label="How AllChess works">
        {workflows.map(({ Icon, detail, href, label }) => (
          <Link key={label} href={href as never} className="focus-ring intro-workflow-step">
            <Icon size={18} />
            <strong>{label}</strong>
            <span>{detail}</span>
          </Link>
        ))}
      </section>

      <nav className="intro-shortcuts" aria-label="Visitor shortcuts">
        <Link href={playSetupHref(locale, { mode: "bot", time: "rapid" }) as never} className="focus-ring">
          <Bot size={16} />
          Bots
        </Link>
        <Link href={`/${locale}/variants`} className="focus-ring">
          <Library size={16} />
          Games & rules
        </Link>
        <Link href={`/${locale}/watch`} className="focus-ring">
          <Eye size={16} />
          Watch
        </Link>
      </nav>
    </>
  );
}
