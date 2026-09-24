"use client";

import { useEffect, useRef } from "react";
import { BookOpen, Check, FlipHorizontal2, Maximize2, Minimize2, Palette } from "lucide-react";
import { getAppearancePresetOptions, type AppearancePresetPreference } from "@/components/board/appearance";
import { PieceIcon } from "@/components/board/piece-icon";
import { getGamePresentation } from "@/lib/variants/presentation";
import { getVariant } from "@/lib/variants/catalog";

export function BoardToolbar({ variantKey, appearancePreset, onAppearanceChange, onFlip, onGuide, focusMode, onFocusChange, canFocus }: {
  variantKey: string;
  appearancePreset: AppearancePresetPreference;
  onAppearanceChange: (preset: AppearancePresetPreference) => void;
  onFlip: () => void;
  onGuide?: () => void;
  focusMode: boolean;
  onFocusChange: () => void;
  canFocus: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const options = getAppearancePresetOptions(variantKey);
  const presentation = getGamePresentation(variantKey);
  const variant = getVariant(variantKey);
  useEffect(() => {
    function close(event: KeyboardEvent) {
      if (event.key === "Escape" && detailsRef.current?.open) {
        detailsRef.current.open = false;
        detailsRef.current.querySelector("summary")?.focus();
      }
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && detailsRef.current?.open && !detailsRef.current.contains(event.target)) detailsRef.current.open = false;
    }
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", outside); };
  }, []);
  return (
    <div className="board-toolbar">
      <details ref={detailsRef} className="board-look-picker">
        <summary className="focus-ring" aria-label="Customize board"><Palette size={16} /><span>Board style</span></summary>
        <div className="board-look-panel">
          <div className="board-look-heading"><strong>Make it yours</strong><span>Saved for this game</span></div>
          <div className="board-look-presets">{options.map((option) => <button type="button" className="focus-ring board-look-preset" key={option.key} aria-pressed={appearancePreset === option.key} aria-label={`Choose ${option.label}`} onClick={() => onAppearanceChange(option.key)}>
            <span className="board-look-preview board-shell" data-board-theme={option.boardTheme} aria-hidden="true"><PieceIcon code={presentation.pieces[1]} owner={variant.players[0]} variantKey={variantKey} pieceSkin={option.pieceSkin} /></span>
            <span>{option.label}</span>{appearancePreset === option.key ? <Check size={13} /> : null}
          </button>)}</div>
        </div>
      </details>
      <div className="board-toolbar-actions">
        {onGuide ? <button type="button" className="focus-ring" onClick={onGuide} aria-label="Board rules" title="Learn this game's rules"><BookOpen size={16} /></button> : null}
        <button type="button" className="focus-ring" onClick={onFlip} aria-label="Rotate board" title="Rotate board"><FlipHorizontal2 size={16} /></button>
        <button type="button" className="focus-ring" onClick={onFocusChange} aria-label={focusMode ? "Exit focus mode" : "Focus mode"} aria-pressed={focusMode} disabled={!canFocus} title={canFocus ? "Focus on the board. Escape to exit." : "Start a game to enter focus mode"}>{focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
      </div>
    </div>
  );
}
