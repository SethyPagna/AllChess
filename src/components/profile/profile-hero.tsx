import Link from "next/link";
import { Settings, UserRound } from "lucide-react";

type ProfileHeroProps = {
  displayName: string;
  isGuest: boolean;
  locale: string;
  settingsLabel: string;
  signInLabel: string | null;
};

export function ProfileHero({ displayName, isGuest, locale, settingsLabel, signInLabel }: ProfileHeroProps) {
  return (
    <header className="profile-head">
      <div className="profile-avatar" aria-hidden="true">
        {isGuest ? <UserRound size={20} aria-hidden="true" /> : initials(displayName)}
      </div>
      <h1 className="acct-title">{displayName}</h1>
      <div className="profile-head-actions">
        {signInLabel ? (
          <Link href={`/${locale}/login`} className="action-secondary focus-ring">
            {signInLabel}
          </Link>
        ) : null}
        <Link href={`/${locale}/settings`} className="icon-btn profile-settings-link focus-ring" aria-label={settingsLabel} title={settingsLabel}>
          <Settings size={18} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

function initials(name: string) {
  const letters = name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("");
  return (letters || "?").toUpperCase();
}
