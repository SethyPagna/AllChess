"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookmarkCheck, Download, Play, Trash2, Upload } from "lucide-react";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getVariant } from "@/lib/variants";
import type { LocalMatchSummary, LocalMatchSnapshot } from "@/lib/game/local-match";
import { listLocalMatches, readLocalMatch, removeLocalMatch, subscribeLocalMatches, writeLocalMatch } from "@/lib/game/local-match-store";
import { downloadLocalMatch, importLocalMatch, maxMatchFileBytes } from "@/lib/game/local-match-transfer";

export function SavedMatches({ locale, variantKey, offline = false, onResume }: {
  locale: string; variantKey?: string; offline?: boolean;
  onResume?: (snapshot: LocalMatchSnapshot, revision: number) => void;
}) {
  const [matches, setMatches] = useState<LocalMatchSummary[]>([]), [error, setError] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null), [loading, setLoading] = useState<string | null>(null);
  const [imported, setImported] = useState<{ id: string; variantKey: string; mode: "offline" | "bot" } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const refresh = useCallback(() => { void listLocalMatches(variantKey).then(setMatches).catch(() => undefined); }, [variantKey]);
  useEffect(() => { refresh(); return subscribeLocalMatches(refresh); }, [refresh]);
  const title = (row: LocalMatchSummary) => { try { return createTranslator(normalizeLocale(locale))(getVariant(row.variantKey).nameKey); } catch { return row.variantKey; } };
  const link = (row: { id: string; variantKey: string; mode: "offline" | "bot" }) => offline
    ? `/offline?game=${encodeURIComponent(row.variantKey)}&locale=${encodeURIComponent(locale)}&mode=${row.mode}&resume=${encodeURIComponent(row.id)}`
    : `/${locale}/play/${encodeURIComponent(row.variantKey)}?mode=${row.mode}&resume=${encodeURIComponent(row.id)}`;
  async function importFile(file: File) {
    setLoading("import"); setError(""); setImported(null);
    try {
      if (file.size > maxMatchFileBytes) throw new Error("Choose an AllChess game file smaller than 16 MB.");
      const snapshot = importLocalMatch(await file.text());
      try { await writeLocalMatch(snapshot, 0); }
      catch { throw new Error("There isn’t enough available storage to import this game, or storage is unavailable. Existing saves are unchanged."); }
      setImported({ id: snapshot.state.id, variantKey: snapshot.state.variantKey, mode: snapshot.settings.playMode }); refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This game could not be imported. Existing saves are unchanged."); }
    finally { setLoading(null); }
  }
  async function exportGame(row: LocalMatchSummary) {
    setLoading(`export:${row.id}`); setError("");
    try { downloadLocalMatch((await readLocalMatch(row.id)).snapshot); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "This game could not be exported."); }
    finally { setLoading(null); }
  }
  async function resume(row: LocalMatchSummary) {
    setLoading(row.id); setError("");
    try { const saved = await readLocalMatch(row.id); onResume?.(saved.snapshot, saved.revision); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "This saved match could not be opened."); }
    finally { setLoading(null); }
  }
  async function remove(row: LocalMatchSummary) {
    setLoading(`remove:${row.id}`);
    try { await removeLocalMatch(row.id, row.revision); setConfirm(null); setError(""); if (imported?.id === row.id) setImported(null); refresh(); }
    catch { setError("This match changed in another window. Check its latest save before removing it."); refresh(); }
    finally { setLoading(null); }
  }
  return <details className="saved-matches">
    <summary className="focus-ring"><BookmarkCheck size={17} /><span>Saved games</span><small>{matches.length} {variantKey ? "for this game" : "on this device"}</small></summary>
    <div className="saved-match-transfer">
      <button type="button" className="focus-ring action-secondary" disabled={Boolean(loading)} onClick={() => input.current?.click()}><Upload size={14} />{loading === "import" ? "Importing…" : "Import game"}</button>
      <input ref={input} type="file" accept=".allchess.json,.json,application/json" aria-label="AllChess game file" hidden onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void importFile(file); }} />
      <small>{matches.length ? "Back up a game or bring one from another device." : variantKey ? "No saves for this game yet." : "Your local games will appear here."}</small>
    </div>
    {imported ? <p className="saved-match-message" role="status">Imported as a separate copy. <a className="focus-ring" href={link(imported)}>Open imported game</a></p> : null}
    {error ? <p className="saved-match-message" role="alert">{error}</p> : null}
    <div className="saved-match-list" aria-busy={Boolean(loading)}>
      {matches.map(row => <div className="saved-match-row" key={row.id}>
        <div><strong>{title(row)}</strong><small>{row.completed ? "Finished" : row.mode === "bot" ? "Bot game" : "Local game"} · {row.ply} moves · {new Date(row.updatedAt).toLocaleDateString(normalizeLocale(locale), { month: "short", day: "numeric" })}</small></div>
        {onResume ? <button type="button" className="focus-ring action-primary" disabled={Boolean(loading)} onClick={() => void resume(row)}><Play size={14} />{loading === row.id ? "Opening…" : row.completed ? "Review" : "Resume"}</button>
          : <a className="focus-ring action-primary" href={link(row)}><Play size={14} />{row.completed ? "Review" : "Resume"}</a>}
        <button type="button" className="focus-ring" disabled={Boolean(loading)} aria-label={`Export ${title(row)} game`} title="Export game" onClick={() => void exportGame(row)}><Download size={14} /></button>
        {confirm === row.id ? <div className="saved-match-remove"><span>Remove this save?</span><button type="button" className="focus-ring" disabled={Boolean(loading)} onClick={() => void remove(row)}>Remove</button><button type="button" className="focus-ring" onClick={() => setConfirm(null)}>Keep</button></div> : <button type="button" className="focus-ring saved-match-delete" disabled={Boolean(loading)} aria-label={`Remove saved ${title(row)} game`} onClick={() => setConfirm(row.id)}><Trash2 size={14} /></button>}
      </div>)}
    </div>
  </details>;
}
