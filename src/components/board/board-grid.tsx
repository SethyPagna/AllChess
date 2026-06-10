"use client";

import { useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from "react";

import { PieceIcon, getPieceDisplayName, type PieceSkinPreference } from "@/components/board/piece-icon";
import { squareName } from "@/components/board/game-board-utils";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getVocabulary } from "@/lib/i18n/vocabulary";
import { sameSquare, serializeSquare, type BoardCell, type Piece, type Square } from "@/lib/variants";

type SuggestedBoardMove = {
  from: Square;
  to: Square;
};

type LegalTargetMode = "move" | "drop";

type DragGhost = {
  piece: Piece;
  size: number;
  x: number;
  y: number;
};

type PlanningArrow = {
  from: Square;
  to: Square;
};

type PlanningDraft = {
  from: Square;
  to: Square;
};

type BoardGridProps = {
  cols: number;
  files: string[];
  legalTargets: ReadonlySet<string>;
  legalTargetMode?: LegalTargetMode;
  locale?: string;
  onChoose: (square: Square) => void;
  onDragMove?: (from: Square, to: Square) => boolean;
  onDropHandPiece?: (code: string, to: Square) => boolean;
  orientedRows: BoardCell[][];
  pieceSkin?: PieceSkinPreference;
  rows: number;
  selected: Square | null;
  suggestedMove: SuggestedBoardMove | null;
  variantKey: string;
};

const handPieceDragType = "application/x-allchess-hand-piece";
const maxPlanningArrows = 12;

export function BoardGrid({ cols, files, legalTargets, legalTargetMode = "move", locale = "en", onChoose, onDragMove, onDropHandPiece, orientedRows, pieceSkin = "default", rows, selected, suggestedMove, variantKey }: BoardGridProps) {
  const terrainLabels = getVocabulary(normalizeLocale(locale)).terrain;
  const gridRef = useRef<HTMLDivElement>(null);
  const [pointerDragSquare, setPointerDragSquare] = useState<Square | null>(null);
  const pointerDragSquareRef = useRef<Square | null>(null);
  const pointerDragMovedRef = useRef(false);
  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null);
  const [invalidDrop, setInvalidDrop] = useState<Square | null>(null);
  const [planningArrows, setPlanningArrows] = useState<PlanningArrow[]>([]);
  const [planningDraft, setPlanningDraft] = useState<PlanningDraft | null>(null);
  const planningDraftRef = useRef<PlanningDraft | null>(null);
  const squareCenters = useMemo(() => buildSquareCenters(orientedRows, cols, rows), [cols, orientedRows, rows]);

  function flashInvalid(square: Square) {
    setInvalidDrop(square);
    window.setTimeout(() => setInvalidDrop((current) => (current && sameSquare(current, square) ? null : current)), 520);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>, target: Square) {
    event.preventDefault();
    const handCode = event.dataTransfer.getData(handPieceDragType);
    const moved = handCode ? (onDropHandPiece?.(handCode, target) ?? false) : false;
    if (!moved) flashInvalid(target);
  }

  function handlePointerDragStart(event: PointerEvent<HTMLDivElement>, origin: Square, piece: Piece) {
    const rect = gridRef.current?.getBoundingClientRect();
    const cellSize = rect ? Math.min(rect.width / cols, rect.height / rows) : 72;
    const ghostSize = Math.max(28, Math.min(96, cellSize * 0.86));
    setPlanningArrows([]);
    pointerDragMovedRef.current = false;
    pointerDragSquareRef.current = origin;
    setPointerDragSquare(origin);
    setDragGhost({ piece, size: ghostSize, x: event.clientX, y: event.clientY });
    onChoose(origin);
  }

  function squareFromEventTarget(target: EventTarget | null) {
    const squareName = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-square]")?.dataset.square : undefined;
    return squareName ? squareFromBoardName(squareName, files, rows) : null;
  }

  function squareFromPoint(clientX: number, clientY: number) {
    const targetElement = document.elementFromPoint(clientX, clientY);
    return squareFromEventTarget(targetElement) ?? squareFromGridPoint(clientX, clientY);
  }

  function squareFromGridPoint(clientX: number, clientY: number) {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const visualCol = Math.min(cols - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * cols)));
    const visualRow = Math.min(rows - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * rows)));
    return orientedRows[visualRow]?.[visualCol]?.square ?? null;
  }

  function pieceAt(square: Square) {
    for (const row of orientedRows) {
      for (const cell of row) {
        if (sameSquare(cell.square, square)) return cell.piece ?? null;
      }
    }
    return null;
  }

  function finishPointerDrag(target: Square | null) {
    const origin = pointerDragSquareRef.current;
    pointerDragSquareRef.current = null;
    setPointerDragSquare(null);
    setDragGhost(null);
    setPlanningArrows([]);
    if (!origin || !target || sameSquare(origin, target)) return;
    const moved = onDragMove?.(origin, target) ?? false;
    if (!moved) flashInvalid(target);
  }

  function startPlanningArrow(origin: Square) {
    planningDraftRef.current = { from: origin, to: origin };
    setPlanningDraft({ from: origin, to: origin });
  }

  function updatePlanningArrow(target: Square | null) {
    const draft = planningDraftRef.current;
    if (!draft || !target) return;
    const nextDraft = { from: draft.from, to: target };
    planningDraftRef.current = nextDraft;
    setPlanningDraft(nextDraft);
  }

  function finishPlanningArrow(target: Square | null) {
    const draft = planningDraftRef.current;
    planningDraftRef.current = null;
    setPlanningDraft(null);
    const to = target ?? draft?.to ?? null;
    if (!draft || !to || sameSquare(draft.from, to)) return;
    setPlanningArrows((current) => {
      const matchingIndex = current.findIndex((arrow) => sameSquare(arrow.from, draft.from) && sameSquare(arrow.to, to));
      if (matchingIndex >= 0) return current.filter((_, index) => index !== matchingIndex);
      return [...current.slice(-(maxPlanningArrows - 1)), { from: draft.from, to }];
    });
  }

  return (
    <div
      ref={gridRef}
      className="board-grid relative overflow-hidden rounded-lg border border-[var(--border)] shadow-2xl"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-label="Game board"
      onPointerDownCapture={(event) => {
        const square = squareFromEventTarget(event.target);
        if (!square) return;
        if (event.button === 2) {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          startPlanningArrow(square);
          return;
        }
        if (event.button !== 0) return;
        setPlanningArrows([]);
        pointerDragMovedRef.current = false;
        const piece = pieceAt(square);
        if (piece) {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          handlePointerDragStart(event, square, piece);
        }
      }}
      onPointerMoveCapture={(event) => {
        const target = squareFromPoint(event.clientX, event.clientY);
        if (planningDraftRef.current) {
          updatePlanningArrow(target);
          return;
        }
        if (!pointerDragSquareRef.current) return;
        pointerDragMovedRef.current = true;
        setDragGhost((current) => (current ? { ...current, x: event.clientX, y: event.clientY } : current));
      }}
      onPointerUpCapture={(event) => {
        const target = squareFromPoint(event.clientX, event.clientY);
        if (event.button === 2) {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          finishPlanningArrow(target);
          return;
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        finishPointerDrag(target);
      }}
      onPointerCancel={() => {
        pointerDragSquareRef.current = null;
        planningDraftRef.current = null;
        setPointerDragSquare(null);
        setDragGhost(null);
        setPlanningDraft(null);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg className="board-planning-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="board-planning-arrow" markerHeight="5" markerWidth="5" orient="auto-start-reverse" refX="4" refY="2.5">
            <path d="M0,0 L5,2.5 L0,5 Z" />
          </marker>
        </defs>
        {[...planningArrows, ...(planningDraft && !sameSquare(planningDraft.from, planningDraft.to) ? [planningDraft] : [])].map((arrow, index) => {
          const from = squareCenters.get(serializeSquare(arrow.from));
          const to = squareCenters.get(serializeSquare(arrow.to));
          if (!from || !to) return null;
          return (
            <line
              key={`${serializeSquare(arrow.from)}-${serializeSquare(arrow.to)}-${index}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              data-planning-preview={planningDraft && index === planningArrows.length ? "true" : undefined}
            />
          );
        })}
      </svg>
      {orientedRows.map((row, visualRow) =>
        row.map((cell, visualCol) => {
          const isSelected = selected && sameSquare(selected, cell.square);
          const isLegal = legalTargets.has(serializeSquare(cell.square));
          const isSuggestedFrom = suggestedMove && sameSquare(suggestedMove.from, cell.square);
          const isSuggestedTo = suggestedMove && sameSquare(suggestedMove.to, cell.square);
          const isInvalidDrop = invalidDrop && sameSquare(invalidDrop, cell.square);
          const dark = (cell.square.row + cell.square.col) % 2 === 1;
          const isDarkPiece = cell.piece?.owner === "black" || cell.piece?.owner === "blue" || cell.piece?.owner === "gote";
          const name = squareName(cell.square, files, rows);
          const fileLabel = String(files[cell.square.col] ?? cell.square.col).toLowerCase();
          const label = cell.piece ? getPieceDisplayName(cell.piece.code, variantKey, locale, cell.piece.promoted) : null;
          const terrainLabel = labelTerrain(cell.terrain, terrainLabels);
          const squareState = isInvalidDrop
            ? "invalid-drop"
            : isSuggestedFrom
              ? "suggested-from"
              : isSuggestedTo
                ? "suggested-to"
                : isLegal
                  ? legalTargetMode === "drop"
                    ? "legal-drop-target"
                    : "legal-target"
                  : isSelected
                    ? "selected"
                    : "idle";
          const squareStatusLabel =
            squareState === "invalid-drop"
              ? "Invalid drop"
              : squareState === "suggested-from"
                ? "Suggested move starts here"
                : squareState === "suggested-to"
                  ? "Suggested move target"
                  : squareState === "legal-target"
                    ? "Legal move target"
                    : squareState === "legal-drop-target"
                      ? "Legal drop target"
                    : squareState === "selected"
                      ? "Selected square"
                      : null;
          const baseSquareLabel = cell.piece && label ? `${name} ${cell.piece.owner} ${label}` : name;
          const terrainSquareLabel = terrainLabel ? `${baseSquareLabel} - ${terrainLabel}` : baseSquareLabel;
          const squareLabel = squareStatusLabel ? `${terrainSquareLabel} - ${squareStatusLabel}` : terrainSquareLabel;

          return (
            <button
              type="button"
              key={serializeSquare(cell.square)}
              onClick={() => {
                if (!pointerDragMovedRef.current) onChoose(cell.square);
              }}
              draggable={false}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, cell.square)}
              onContextMenu={(event) => event.preventDefault()}
              className="board-square focus-ring relative grid place-items-center overflow-hidden font-black"
              aria-label={squareLabel}
              title={squareLabel}
              data-square={name}
              data-coordinate={name}
              data-terrain={cell.terrain && cell.terrain !== "land" ? cell.terrain : undefined}
              data-legal-target={isLegal ? legalTargetMode : undefined}
              data-piece-label={label ?? undefined}
              data-square-state={squareState === "idle" ? undefined : squareState}
              data-dragging={pointerDragSquare && sameSquare(pointerDragSquare, cell.square) ? "true" : undefined}
              data-invalid-drop={isInvalidDrop ? "true" : undefined}
              data-tone={dark ? "dark" : "light"}
              data-suggested={isSuggestedFrom ? "from" : isSuggestedTo ? "to" : undefined}
              style={{
                background: isInvalidDrop
                  ? "color-mix(in srgb, var(--danger) 72%, var(--surface))"
                  : isSelected
                  ? "var(--accent)"
                  : isSuggestedFrom || isSuggestedTo
                    ? "color-mix(in srgb, var(--info) 46%, var(--board-light))"
                    : isLegal
                      ? legalTargetMode === "drop"
                        ? "color-mix(in srgb, var(--info) 30%, var(--accent-soft))"
                        : "color-mix(in srgb, var(--accent) 34%, var(--board-light))"
                      : dark
                        ? "var(--board-dark)"
                        : "var(--board-light)",
                color: isDarkPiece ? "var(--piece-dark)" : "var(--piece-light)"
              }}
            >
              {cell.piece ? <PieceIcon code={cell.piece.code} owner={cell.piece.owner} pieceSkin={pieceSkin} variantKey={variantKey} locale={locale} promoted={cell.piece.promoted} /> : null}
              {visualCol === 0 ? <span className="board-coordinate board-rank">{rows - cell.square.row}</span> : null}
              {visualRow === rows - 1 ? <span className="board-coordinate board-file">{fileLabel}</span> : null}
            </button>
          );
        })
      )}
      {dragGhost ? (
        <span
          className="board-drag-ghost"
          aria-hidden="true"
          style={
            {
              "--drag-piece-size": `${dragGhost.size}px`,
              left: dragGhost.x,
              top: dragGhost.y
            } as CSSProperties
          }
        >
          <PieceIcon code={dragGhost.piece.code} owner={dragGhost.piece.owner} pieceSkin={pieceSkin} variantKey={variantKey} locale={locale} promoted={dragGhost.piece.promoted} />
        </span>
      ) : null}
    </div>
  );
}

function buildSquareCenters(orientedRows: BoardCell[][], cols: number, rows: number) {
  const centers = new Map<string, { x: number; y: number }>();
  orientedRows.forEach((row, visualRow) => {
    row.forEach((cell, visualCol) => {
      centers.set(serializeSquare(cell.square), {
        x: ((visualCol + 0.5) / cols) * 100,
        y: ((visualRow + 0.5) / rows) * 100
      });
    });
  });
  return centers;
}

function squareFromBoardName(name: string, files: string[], rows: number): Square | null {
  const file = name[0];
  const rank = Number(name.slice(1));
  const col = files.indexOf(file);
  if (col < 0 || Number.isNaN(rank)) return null;
  return { row: rows - rank, col };
}

function labelTerrain(terrain: BoardCell["terrain"], labels: Record<string, string>) {
  if (terrain === "promotion-zone") return labels.promotionZone;
  if (terrain === "palace") return labels.palace;
  if (terrain === "river") return labels.river;
  if (terrain === "den") return labels.den;
  if (terrain === "trap") return labels.trap;
  if (terrain === "camp") return labels.camp;
  return null;
}
