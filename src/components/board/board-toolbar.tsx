"use client";

import { useEffect, useRef } from "react";
import { BookOpen, Check, FlipHorizontal2, Maximize2, Minimize2, Palette } from "lucide-react";
import { boardThemeOptions, getAppearancePresetOptions, type AppearancePresetPreference } from "@/components/board/appearance";
import { PieceIcon } from "@/components/board/piece-icon";
import { getGamePresentation } from "@/lib/variants/presentation";
import { getVariant } from "@/lib/variants/catalog";
import { pieceSetOptions, pieceSetSkin, resolvePieceSet, type PieceSetId } from "./piece-sets";

export function BoardToolbar({ variantKey, appearancePreset, onAppearanceChange, onFlip, onGuide, focusMode, onFocusChange, canFocus, is3D = false, pieceSet: pieceSetPreference, onPieceSetChange }: {
  variantKey: string;
  appearancePreset: AppearancePresetPreference;
  onAppearanceChange: (preset: AppearancePresetPreference) => void;
  onFlip: () => void;
  onGuide?: () => void;
  focusMode: boolean;
  onFocusChange: () => void;
  canFocus: boolean;
  is3D?: boolean;
  pieceSet?: PieceSetId;
  onPieceSetChange?: (set: PieceSetId) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const presets = getAppearancePresetOptions(variantKey);
  const selected = presets.find(option => option.key === appearancePreset) ?? presets[0];
  const sets = pieceSetOptions(variantKey);
  const pieceSet = resolvePieceSet(variantKey, pieceSetPreference);
  const separatePieces = sets.length > 1 && !!onPieceSetChange;
  const coloursOnly = is3D || separatePieces;
  const options = coloursOnly ? presets.filter((option, index) => presets.findIndex(item => item.boardTheme === option.boardTheme) === index).map(option => ({ ...option, label: boardThemeOptions.find(theme => theme.key === option.boardTheme)!.label })) : presets;
  const isSelected = (option: typeof selected) => coloursOnly ? selected.boardTheme === option.boardTheme : appearancePreset === option.key;
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
          {separatePieces ? <><div className="board-look-heading"><strong>Pieces</strong><span>2D + 3D</span></div><div className="piece-set-choices" role="group" aria-label="Piece collection">{sets.map(set => <button type="button" className="focus-ring piece-set-choice" key={set.key} aria-label={`Choose ${set.label} pieces`} aria-pressed={pieceSet === set.key} onClick={() => onPieceSetChange?.(set.key)}><span aria-hidden="true"><PieceIcon code="p" owner={variant.players[0]} variantKey={variantKey} pieceSkin={set.skin}/><PieceIcon code="x" owner={variant.players[1]} variantKey={variantKey} pieceSkin={set.skin} promoted/></span><strong>{set.label}</strong>{pieceSet === set.key ? <Check size={14}/> : null}</button>)}</div></> : null}
          <div className="board-look-heading"><strong>{coloursOnly ? "Board colours" : "Make it yours"}</strong><span>Saved for this game</span></div>
          <div className="board-look-presets">{options.map((option) => <button type="button" className="focus-ring board-look-preset" key={option.key} aria-pressed={isSelected(option)} aria-label={`Choose ${option.label}`} onClick={() => onAppearanceChange(option.key)}>
            <span className="board-look-preview board-shell" data-board-theme={option.boardTheme} aria-hidden="true" style={is3D && ["ouk-chaktrang", "shogi", "mini-shogi", "xiangqi", "janggi", "makruk", "turkish-draughts", "konane", "shatranj", "chaturanga", "jungle"].includes(variantKey) ? { background: "var(--board-light)" } : undefined}>{!is3D ? <PieceIcon code={presentation.pieces[1]} owner={variant.players[0]} variantKey={variantKey} pieceSkin={pieceSetSkin(variantKey, pieceSet, option.pieceSkin)} /> : null}</span>
            <span>{option.label}</span>{isSelected(option) ? <Check size={13} /> : null}
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
