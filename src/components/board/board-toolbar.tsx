"use client";

import { useRef, type ReactNode } from "react";
import { Check, FlipHorizontal2, Maximize2, Minimize2, Palette } from "lucide-react";
import { useDismissableDetails } from "@/components/ui/use-dismissable-details";
import { boardThemeOptions, getAppearancePresetOptions, type AppearancePresetPreference } from "@/components/board/appearance";
import { PieceIcon } from "@/components/board/piece-icon";
import { getGamePresentation } from "@/lib/variants/presentation";
import { getVariant } from "@/lib/variants/catalog";
import { piece2DSkin, piece2DStyleOptions, pieceSetOptions, pieceSetPreviewPieces, resolvePieceSet, type Piece2DStyle, type PieceSetId } from "./piece-sets";

export function BoardToolbar({ variantKey, appearancePreset, onAppearanceChange, onFlip, focusMode, onFocusChange, canFocus, is3D = false, pieceSet: pieceSetPreference, onPieceSetChange, piece2DStyle = "collection", onPiece2DStyleChange, viewControls, panelControls }: {
  variantKey: string;
  appearancePreset: AppearancePresetPreference;
  onAppearanceChange: (preset: AppearancePresetPreference) => void;
  onFlip: () => void;
  viewControls?: ReactNode;
  panelControls?: ReactNode;
  focusMode: boolean;
  onFocusChange: () => void;
  canFocus: boolean;
  is3D?: boolean;
  pieceSet?: PieceSetId;
  onPieceSetChange?: (set: PieceSetId) => void;
  piece2DStyle?: Piece2DStyle;
  onPiece2DStyleChange?: (style: Piece2DStyle) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const presets = getAppearancePresetOptions(variantKey);
  const selected = presets.find(option => option.key === appearancePreset) ?? presets[0];
  const sets = pieceSetOptions(variantKey);
  const collectionPreview = pieceSetPreviewPieces(variantKey);
  const readableStyles = piece2DStyleOptions(variantKey);
  const pieceSet = resolvePieceSet(variantKey, pieceSetPreference);
  const separatePieces = sets.length > 1 && !!onPieceSetChange;
  const coloursOnly = is3D || separatePieces;
  const options = coloursOnly ? presets.filter((option, index) => presets.findIndex(item => item.boardTheme === option.boardTheme) === index).map(option => ({ ...option, label: variantKey === "konane" && pieceSet === "shore" && option.boardTheme === "wood" ? "Stone" : boardThemeOptions.find(theme => theme.key === option.boardTheme)!.label })) : presets;
  const isSelected = (option: typeof selected) => coloursOnly ? selected.boardTheme === option.boardTheme : appearancePreset === option.key;
  const presentation = getGamePresentation(variantKey);
  const variant = getVariant(variantKey);
  useDismissableDetails(detailsRef);
  return (
    <div className="board-toolbar">
      <details ref={detailsRef} className="board-look-picker">
        <summary className="focus-ring icon-btn" aria-label="Customize board" title="Board style"><Palette size={17} /></summary>
        <div className="board-look-panel popover">
          {panelControls}
          {separatePieces ? <><div className="board-look-heading"><strong>Pieces</strong></div><div className="piece-set-choices" data-collection-count={sets.length} role="group" aria-label="Piece collection">{sets.map(set => <button type="button" className="focus-ring piece-set-choice" key={set.key} aria-label={`Choose ${set.label} pieces`} aria-pressed={pieceSet === set.key} onClick={() => onPieceSetChange?.(set.key)}><span aria-hidden="true">{collectionPreview.map((sample, index) => <PieceIcon key={`${sample.code}:${variant.players[index]}`} {...sample} owner={variant.players[index]} variantKey={variantKey} pieceSkin={set.skin}/>)}</span><strong>{set.label}</strong>{pieceSet === set.key ? <Check size={14}/> : null}</button>)}</div></> : null}
          {!is3D && readableStyles.length > 0 && onPiece2DStyleChange ? <><div className="board-look-heading"><strong>2D style</strong></div><div className="piece-2d-choices" role="group" aria-label="2D piece style">{readableStyles.map(style => <button type="button" className="focus-ring piece-2d-choice" key={style.key} aria-label={`Use ${style.label} pieces`} aria-pressed={piece2DStyle === style.key} onClick={() => onPiece2DStyleChange(style.key)}><span aria-hidden="true"><PieceIcon code={collectionPreview[0]?.code ?? "k"} owner={variant.players[0]} variantKey={variantKey} pieceSkin={piece2DSkin(variantKey, pieceSet, selected.pieceSkin, style.key)}/></span><span>{style.label}</span></button>)}</div></> : null}
          <div className="board-look-heading"><strong>{coloursOnly ? "Board colours" : "Board & pieces"}</strong></div>
          <div className="board-look-presets">{options.map((option) => <button type="button" className="focus-ring board-look-preset" key={option.key} aria-pressed={isSelected(option)} aria-label={`Choose ${option.label}`} onClick={() => onAppearanceChange(option.key)}>
            <span className="board-look-preview board-shell" data-board-theme={option.boardTheme} data-piece-set={pieceSet} aria-hidden="true" style={is3D && ["ouk-chaktrang", "shogi", "mini-shogi", "xiangqi", "janggi", "makruk", "turkish-draughts", "konane", "shatranj", "chaturanga", "jungle"].includes(variantKey) ? { background: "var(--board-light)" } : undefined}>{!is3D ? <PieceIcon code={presentation.pieces[1]} owner={variant.players[0]} variantKey={variantKey} pieceSkin={piece2DSkin(variantKey, pieceSet, option.pieceSkin, piece2DStyle)} /> : null}</span>
            <span>{option.label}</span>{isSelected(option) ? <Check size={13} /> : null}
          </button>)}</div>
        </div>
      </details>
      {viewControls}
      <div className="board-toolbar-actions">
        <button type="button" className="focus-ring icon-btn" onClick={onFlip} aria-label="Rotate board" title="Rotate board"><FlipHorizontal2 size={17} /></button>
        <button type="button" className="focus-ring icon-btn" onClick={onFocusChange} aria-label={focusMode ? "Exit focus mode" : "Focus mode"} aria-pressed={focusMode} disabled={!canFocus} title={canFocus ? "Focus on the board. Escape to exit." : "Start a game to enter focus mode"}>{focusMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
      </div>
    </div>
  );
}
