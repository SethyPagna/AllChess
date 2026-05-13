import Link from "next/link";
import { Bot, Eye, Globe2, Lock, MonitorSmartphone, Radio, Swords, Users } from "lucide-react";

import { displayGameName, getGameCatalog } from "@/lib/catalog";
import { normalizeLocale } from "@/lib/i18n/locales";

const playModes = [
  { key: "online", label: "Play Online", description: "Queue for a live opponent with matching settings.", Icon: Globe2, hrefSuffix: "?mode=online" },
  { key: "bot", label: "Play Bots", description: "Practice from Easy through Legend with side choice.", Icon: Bot, hrefSuffix: "?bot=normal&mode=bot" },
  { key: "offline", label: "Offline Local", description: "Two players on the same device.", Icon: MonitorSmartphone, hrefSuffix: "?mode=offline" },
  { key: "room", label: "Create Room", description: "Create a shareable room code for friends.", Icon: Lock, hrefSuffix: "?mode=room" },
  { key: "matchmaking", label: "Matchmaking", description: "Pick time, rating band, and rated/casual.", Icon: Users, hrefSuffix: "?mode=matchmaking" },
  { key: "spectate", label: "Spectate", description: "Watch active public rooms and bot games.", Icon: Eye, hrefSuffix: "?mode=spectate" }
];

export default async function PlaySetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const playable = getGameCatalog().filter((entry) => entry.playability === "playable" && entry.variantKey);
  const featured = playable.slice(0, 8);

  return (
    <section className="play-setup-page grid gap-5">
      <div className="panel play-setup-hero">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">
            <Swords size={16} />
            Play setup
          </p>
          <h1>Choose how you want to play</h1>
          <p>Pick a mode first, then choose the game, side, time control, and bot tier before the board starts.</p>
        </div>
        <Link href={`/${locale}/play/classic?bot=normal&mode=bot`} className="focus-ring action-primary inline-flex items-center gap-2 px-4 py-3">
          <Bot size={18} />
          Quick bot game
        </Link>
      </div>
      <div className="play-mode-browser">
        {playModes.map(({ key, label, description, Icon, hrefSuffix }) => (
          <article key={key} className="panel play-mode-card">
            <Icon size={24} />
            <div>
              <h2>{label}</h2>
              <p>{description}</p>
            </div>
            <div className="play-mode-card-games">
              {featured.slice(0, 4).map((entry) => (
                <Link key={`${key}-${entry.id}`} href={`/${locale}/play/${entry.variantKey}${hrefSuffix}`} className="focus-ring">
                  <Radio size={14} />
                  {displayGameName(entry)}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
