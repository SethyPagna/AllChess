"use client";

import { useEffect, useRef } from "react";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import { PieceIcon, type PieceSkinPreference } from "@/components/board/piece-icon";
import type { Piece } from "@/lib/variants";

export type PlayMoveListEntry = {
  ply: number;
  text: string;
  pieceLabel: string;
  piece: Piece | null;
};

type PlayMoveListProps = {
  entries: PlayMoveListEntry[];
  activePly: number;
  reviewing: boolean;
  playing: boolean;
  locale: string;
  pieceSkin: PieceSkinPreference;
  variantKey: string;
  onSelect: (ply: number) => void;
  onLive: () => void;
  onTogglePlay: () => void;
};

/** Paired move list (1. e4 e5) with compact playback controls; the last move always returns to the live board. */
export function PlayMoveList({ entries, activePly, reviewing, playing, locale, pieceSkin, variantKey, onSelect, onLive, onTogglePlay }: PlayMoveListProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const livePly = entries.length;
  const pairs: PlayMoveListEntry[][] = [];
  entries.forEach((entry, index) => {
    if (index % 2 === 0) pairs.push([entry]);
    else pairs[pairs.length - 1]!.push(entry);
  });

  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>("[aria-current='true']");
    if (!list) return;
    if (!active) { list.scrollTop = list.scrollHeight; return; }
    const top = active.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + active.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top - list.clientHeight / 2;
  }, [activePly, entries.length]);

  const select = (ply: number) => (ply >= livePly ? onLive() : onSelect(Math.max(0, ply)));
  const currentPly = reviewing ? activePly : livePly;

  return (
    <section className="move-panel" aria-label="Moves">
      {entries.length ? (
        <ol ref={listRef} className="move-pairs">
          {pairs.map((pair, index) => (
            <li key={pair[0]!.ply}>
              <span className="move-no">{index + 1}</span>
              {pair.map((entry) => (
                <button
                  key={entry.ply}
                  type="button"
                  className="focus-ring move-cell"
                  aria-current={reviewing && activePly === entry.ply ? "true" : undefined}
                  data-latest={!reviewing && entry.ply === livePly ? "true" : undefined}
                  aria-label={`Move ${entry.ply}: ${entry.pieceLabel} ${entry.text}`}
                  onClick={() => select(entry.ply)}
                >
                  {entry.piece ? <PieceIcon code={entry.piece.code} owner={entry.piece.owner} pieceSkin={pieceSkin} variantKey={variantKey} locale={locale} promoted={entry.piece.promoted} /> : null}
                  <span>{entry.text}</span>
                </button>
              ))}
            </li>
          ))}
        </ol>
      ) : (
        <p className="move-empty">No moves yet</p>
      )}
      <div className="review-controls" aria-label="Review playback controls">
        <button type="button" className="focus-ring icon-btn" aria-label="First move" disabled={!entries.length || currentPly === 0} onClick={() => select(0)}><ChevronFirst size={17} /></button>
        <button type="button" className="focus-ring icon-btn" aria-label="Previous move" disabled={!entries.length || currentPly === 0} onClick={() => select(currentPly - 1)}><ChevronLeft size={17} /></button>
        <button type="button" className="focus-ring icon-btn" aria-label={playing ? "Pause review" : "Play review"} disabled={!entries.length} onClick={onTogglePlay}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <button type="button" className="focus-ring icon-btn" aria-label="Next move" disabled={!reviewing} onClick={() => select(currentPly + 1)}><ChevronRight size={17} /></button>
        <button type="button" className="focus-ring icon-btn" aria-label="Last move" disabled={!reviewing} onClick={onLive}><ChevronLast size={17} /></button>
      </div>
    </section>
  );
}
