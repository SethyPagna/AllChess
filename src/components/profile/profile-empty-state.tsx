import Link from "next/link";

import { playSetupHref } from "@/lib/routing/play-links";

export function ProfileEmptyState({ locale }: { locale: string }) {
  return (
    <div className="profile-empty">
      <p>No matches yet</p>
      <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="action-primary focus-ring">
        Start playing
      </Link>
    </div>
  );
}
