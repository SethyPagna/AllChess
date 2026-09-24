"use client";

import { useCallback, useEffect, useState } from "react";
import { BookmarkCheck, Play, Trash2 } from "lucide-react";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getVariant } from "@/lib/variants";
import type { LocalMatchSummary, LocalMatchSnapshot } from "@/lib/game/local-match";
import { listLocalMatches, readLocalMatch, removeLocalMatch, subscribeLocalMatches } from "@/lib/game/local-match-store";

export function SavedMatches({ locale, variantKey, offline = false, onResume }: {
  locale: string; variantKey?: string; offline?: boolean;
  onResume?: (snapshot: LocalMatchSnapshot, revision: number) => void;
}) {
  const [matches, setMatches] = useState<LocalMatchSummary[]>([]), [error, setError] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null), [loading, setLoading] = useState<string | null>(null);
  const refresh = useCallback(() => { void listLocalMatches(variantKey).then(setMatches).catch(() => undefined); }, [variantKey]);
  useEffect(() => { refresh(); return subscribeLocalMatches(refresh); }, [refresh]);
  const title = (row: LocalMatchSummary) => { try { return createTranslator(normalizeLocale(locale))(getVariant(row.variantKey).nameKey); } catch { return row.variantKey; } };
  async function resume(row: LocalMatchSummary) {
    setLoading(row.id); setError("");
    try { const saved = await readLocalMatch(row.id); onResume?.(saved.snapshot, saved.revision); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "This saved match could not be opened."); }
    finally { setLoading(null); }
  }
  async function remove(row: LocalMatchSummary) {
    try { await removeLocalMatch(row.id, row.revision); setConfirm(null); setError(""); refresh(); }
    catch { setError("This match changed in another window. Check its latest save before removing it."); refresh(); }
  }
  if (!matches.length) return null;
  return <details className="saved-matches">
    <summary className="focus-ring"><BookmarkCheck size={17} /><span>Saved games</span><small>{matches.length} on this device</small></summary>
    <div className="saved-match-list">
      {matches.map(row => <div className="saved-match-row" key={row.id}>
        <div><strong>{title(row)}</strong><small>{row.completed ? "Finished" : row.mode === "bot" ? "Bot game" : "Local game"} · {row.ply} moves · {new Date(row.updatedAt).toLocaleDateString(normalizeLocale(locale), { month: "short", day: "numeric" })}</small></div>
        {onResume ? <button type="button" className="focus-ring action-primary" disabled={Boolean(loading)} onClick={() => void resume(row)}><Play size={14} />{loading === row.id ? "Opening…" : row.completed ? "Review" : "Resume"}</button>
          : <a className="focus-ring action-primary" href={offline ? `/offline?game=${encodeURIComponent(row.variantKey)}&locale=${encodeURIComponent(locale)}&resume=${encodeURIComponent(row.id)}` : `/${locale}/play/${encodeURIComponent(row.variantKey)}?mode=${row.mode}&resume=${encodeURIComponent(row.id)}`}><Play size={14} />{row.completed ? "Review" : "Resume"}</a>}
        {confirm === row.id ? <div className="saved-match-remove"><span>Remove this save?</span><button type="button" className="focus-ring" onClick={() => void remove(row)}>Remove</button><button type="button" className="focus-ring" onClick={() => setConfirm(null)}>Keep</button></div> : <button type="button" className="focus-ring saved-match-delete" aria-label={`Remove saved ${title(row)} game`} onClick={() => setConfirm(row.id)}><Trash2 size={14} /></button>}
      </div>)}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  </details>;
}
