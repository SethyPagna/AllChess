"use client";

import { useRef, useState, type DragEvent, type MouseEvent } from "react";

import { PieceIcon, getPieceDisplayName, type PieceSkinPreference } from "@/components/board/piece-icon";
import { squareName } from "@/components/board/game-board-utils";
import { sameSquare, serializeSquare, type BoardCell, type Square } from "@/lib/variants";

type SuggestedBoardMove = {
  from: Square;
  to: Square;
};

type BoardGridProps = {
  cols: number;
  files: string[];
  legalTargets: ReadonlySet<string>;
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

export function BoardGrid({ cols, files, legalTargets, locale = "en", onChoose, onDragMove, onDropHandPiece, orientedRows, pieceSkin = "default", rows, selected, suggestedMove, variantKey }: BoardGridProps) {
  const [draggingSquare, setDraggingSquare] = useState<Square | null>(null);
  const [pointerDragSquare, setPointerDragSquare] = useState<Square | null>(null);
  const pointerDragSquareRef = useRef<Square | null>(null);
  const [invalidDrop, setInvalidDrop] = useState<Square | null>(null);
  const [planningOrigin, setPlanningOrigin] = useState<Square | null>(null);
  const [planningArrows, setPlanningArrows] = useState<SuggestedBoardMove[]>([]);

  function flashInvalid(square: Square) {
    setInvalidDrop(square);
    window.setTimeout(() => setInvalidDrop((current) => (current && sameSquare(current, square) ? null : current)), 520);
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>, cell: BoardCell) {
    if (!cell.piece) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-allchess-square", serializeSquare(cell.square));
    setTransparentDragImage(event);
    setDraggingSquare(cell.square);
    onChoose(cell.square);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>, target: Square) {
    event.preventDefault();
    const handCode = event.dataTransfer.getData(handPieceDragType);
    const sourceSquare = squareFromSerialized(event.dataTransfer.getData("application/x-allchess-square")) ?? draggingSquare;
    const moved = handCode ? (onDropHandPiece?.(handCode, target) ?? false) : sourceSquare ? (onDragMove?.(sourceSquare, target) ?? false) : false;
    if (!moved) flashInvalid(target);
    setDraggingSquare(null);
  }

  function handlePointerDragStart(origin: Square) {
    pointerDragSquareRef.current = origin;
    setPointerDragSquare(origin);
    window.addEventListener(
      "pointerup",
      (event) => {
        const targetElement = document.elementFromPoint(event.clientX, event.clientY);
        const targetSquareName = targetElement instanceof HTMLElement ? targetElement.closest<HTMLElement>("[data-square]")?.dataset.square : undefined;
        const target = targetSquareName ? squareFromBoardName(targetSquareName, files, rows) : null;
        if (!pointerDragSquareRef.current || !sameSquare(pointerDragSquareRef.current, origin)) return;
        pointerDragSquareRef.current = null;
        setPointerDragSquare(null);
        if (!target || sameSquare(origin, target)) return;
        const moved = onDragMove?.(origin, target) ?? false;
        if (!moved) flashInvalid(target);
      },
      { once: true }
    );
  }

  function handleMouseDragStart(origin: Square) {
    pointerDragSquareRef.current = origin;
    setPointerDragSquare(origin);
    window.addEventListener(
      "mouseup",
      (event) => {
        const targetElement = document.elementFromPoint(event.clientX, event.clientY);
        const targetSquareName = targetElement instanceof HTMLElement ? targetElement.closest<HTMLElement>("[data-square]")?.dataset.square : undefined;
        const target = targetSquareName ? squareFromBoardName(targetSquareName, files, rows) : null;
        if (!pointerDragSquareRef.current || !sameSquare(pointerDragSquareRef.current, origin)) return;
        pointerDragSquareRef.current = null;
        setPointerDragSquare(null);
        if (!target || sameSquare(origin, target)) return;
        const moved = onDragMove?.(origin, target) ?? false;
        if (!moved) flashInvalid(target);
      },
      { once: true }
    );
  }

  function squareFromEventTarget(target: EventTarget | null) {
    const squareName = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-square]")?.dataset.square : undefined;
    return squareName ? squareFromBoardName(squareName, files, rows) : null;
  }

  function squareFromPoint(clientX: number, clientY: number) {
    const targetElement = document.elementFromPoint(clientX, clientY);
    return squareFromEventTarget(targetElement);
  }

  function hasPieceAt(square: Square) {
    return orientedRows.some((row) => row.some((cell) => sameSquare(cell.square, square) && Boolean(cell.piece)));
  }

  function visualCenter(square: Square) {
    for (let visualRow = 0; visualRow < orientedRows.length; visualRow += 1) {
      const visualCol = orientedRows[visualRow]?.findIndex((cell) => sameSquare(cell.square, square)) ?? -1;
      if (visualCol >= 0) {
        return {
          x: ((visualCol + 0.5) / cols) * 100,
          y: ((visualRow + 0.5) / rows) * 100
        };
      }
    }
    return null;
  }

  function handlePlanningMark(event: MouseEvent<HTMLButtonElement>, square: Square) {
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) {
      setPlanningOrigin(null);
      setPlanningArrows([]);
      return;
    }
    if (!planningOrigin) {
      setPlanningOrigin(square);
      return;
    }
    if (sameSquare(planningOrigin, square)) {
      setPlanningOrigin(null);
      return;
    }
    setPlanningArrows((current) => [...current, { from: planningOrigin, to: square }].slice(-12));
    setPlanningOrigin(null);
  }

  function finishPointerDrag(target: Square | null) {
    const origin = pointerDragSquareRef.current;
    pointerDragSquareRef.current = null;
    setPointerDragSquare(null);
    if (!origin || !target || sameSquare(origin, target)) return;
    const moved = onDragMove?.(origin, target) ?? false;
    if (!moved) flashInvalid(target);
  }

  return (
    <div
      className="board-grid relative overflow-hidden rounded-lg border border-[var(--border)] shadow-2xl"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-label="Game board"
      onMouseDownCapture={(event) => {
        const square = squareFromEventTarget(event.target);
        if (square && hasPieceAt(square)) handleMouseDragStart(square);
      }}
      onMouseUpCapture={(event) => {
        finishPointerDrag(squareFromPoint(event.clientX, event.clientY));
      }}
      onPointerDownCapture={(event) => {
        const square = squareFromEventTarget(event.target);
        if (square && hasPieceAt(square)) handlePointerDragStart(square);
      }}
      onPointerUpCapture={(event) => {
        finishPointerDrag(squareFromPoint(event.clientX, event.clientY));
      }}
    >
      <svg className="board-planning-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="board-planning-arrow" markerHeight="5" markerWidth="5" orient="auto-start-reverse" refX="4" refY="2.5">
            <path d="M0,0 L5,2.5 L0,5 Z" />
          </marker>
        </defs>
        {planningArrows.map((arrow, index) => {
          const from = visualCenter(arrow.from);
          const to = visualCenter(arrow.to);
          if (!from || !to) return null;
          return <line key={`${serializeSquare(arrow.from)}-${serializeSquare(arrow.to)}-${index}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
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
          const label = cell.piece ? getPieceDisplayName(cell.piece.code, variantKey, locale, cell.piece.promoted) : null;
          const squareState = isInvalidDrop
            ? "invalid-drop"
            : isSuggestedFrom
              ? "suggested-from"
              : isSuggestedTo
                ? "suggested-to"
                : isLegal
                  ? "legal-target"
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
                    : squareState === "selected"
                      ? "Selected square"
                      : null;
          const baseSquareLabel = cell.piece && label ? `${name} ${cell.piece.owner} ${label}` : name;
          const squareLabel = squareStatusLabel ? `${baseSquareLabel} - ${squareStatusLabel}` : baseSquareLabel;

          return (
            <button
              type="button"
              key={serializeSquare(cell.square)}
              onClick={() => onChoose(cell.square)}
              draggable={Boolean(cell.piece)}
              onDragStart={(event) => handleDragStart(event, cell)}
              onDragEnd={() => setDraggingSquare(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, cell.square)}
              onContextMenu={(event) => handlePlanningMark(event, cell.square)}
              className="board-square focus-ring relative grid place-items-center overflow-hidden font-black"
              aria-label={squareLabel}
              title={squareLabel}
              data-square={name}
              data-coordinate={name}
              data-legal-target={isLegal ? "true" : undefined}
              data-piece-label={label ?? undefined}
              data-square-state={squareState === "idle" ? undefined : squareState}
              data-dragging={(draggingSquare && sameSquare(draggingSquare, cell.square)) || (pointerDragSquare && sameSquare(pointerDragSquare, cell.square)) ? "true" : undefined}
              data-invalid-drop={isInvalidDrop ? "true" : undefined}
              data-planning-origin={planningOrigin && sameSquare(planningOrigin, cell.square) ? "true" : undefined}
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
                      ? "color-mix(in srgb, var(--accent) 34%, var(--board-light))"
                      : dark
                        ? "var(--board-dark)"
                        : "var(--board-light)",
                color: isDarkPiece ? "var(--piece-dark)" : "var(--piece-light)"
              }}
            >
              {cell.piece ? <PieceIcon code={cell.piece.code} owner={cell.piece.owner} pieceSkin={pieceSkin} variantKey={variantKey} locale={locale} promoted={cell.piece.promoted} /> : null}
              {visualCol === 0 ? <span className="board-coordinate board-rank">{rows - cell.square.row}</span> : null}
              {visualRow === rows - 1 ? <span className="board-coordinate board-file">{files[cell.square.col]}</span> : null}
            </button>
          );
        })
      )}
    </div>
  );
}

function squareFromBoardName(name: string, files: string[], rows: number): Square | null {
  const file = name[0];
  const rank = Number(name.slice(1));
  const col = files.indexOf(file);
  if (col < 0 || Number.isNaN(rank)) return null;
  return { row: rows - rank, col };
}

function squareFromSerialized(value: string): Square | null {
  const [rowValue, colValue] = value.split(":");
  const row = Number(rowValue);
  const col = Number(colValue);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  return { row, col };
}

function setTransparentDragImage(event: DragEvent<HTMLButtonElement>) {
  const dragImage = document.createElement("span");
  dragImage.style.position = "fixed";
  dragImage.style.top = "0";
  dragImage.style.left = "0";
  dragImage.style.width = "1px";
  dragImage.style.height = "1px";
  dragImage.style.opacity = "0";
  dragImage.style.pointerEvents = "none";
  document.body.appendChild(dragImage);
  event.dataTransfer.setDragImage(dragImage, 0, 0);
  window.setTimeout(() => dragImage.remove(), 0);
}
