import Link from "next/link";
import { History, Swords } from "lucide-react";

import { EmptyNote } from "@/components/community/empty-note";
import { playSetupHref } from "@/lib/routing/play-links";

export function HistoryEmptyState({ hasSavedRows, locale }: { hasSavedRows: boolean; locale: string }) {
  if (hasSavedRows) {
    return (
      <EmptyNote title="No matching games" text="Try another search or result.">
        <Link className="action-secondary focus-ring" href={`/${locale}/history`}>Clear filters</Link>
      </EmptyNote>
    );
  }

  return (
    <EmptyNote icon={History} title="No online games yet" text="Online games you finish appear here, with review links and rating changes.">
      <Link className="action-primary focus-ring" href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never}>
        <Swords size={16} />
        Play online
      </Link>
    </EmptyNote>
  );
}
