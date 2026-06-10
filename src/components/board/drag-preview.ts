import type { DragEvent } from "react";

type DragImageOffsetInput = {
  clientX: number;
  clientY: number;
  height: number;
  pieceRect: Pick<DOMRect, "height" | "left" | "top" | "width">;
  width: number;
};

export function setPieceDragImage(event: DragEvent<HTMLElement>) {
  const piece = event.currentTarget.querySelector<HTMLElement>(".piece-icon");
  if (!piece) return;

  const pieceRect = piece.getBoundingClientRect();
  const pieceStyle = window.getComputedStyle(piece);
  const width = Math.max(32, Math.min(92, pieceRect.width || event.currentTarget.getBoundingClientRect().width * 0.82));
  const height = Math.max(32, Math.min(92, pieceRect.height || width));
  const dragImage = document.createElement("span");
  dragImage.className = "piece-drag-preview";
  dragImage.setAttribute("aria-hidden", "true");
  dragImage.style.width = `${width}px`;
  dragImage.style.height = `${height}px`;
  dragImage.style.fontSize = pieceStyle.fontSize;
  dragImage.appendChild(piece.cloneNode(true));
  document.body.appendChild(dragImage);

  const offset = getDragImageOffset({ clientX: event.clientX, clientY: event.clientY, height, pieceRect, width });
  event.dataTransfer.setDragImage(dragImage, offset.x, offset.y);
  window.setTimeout(() => dragImage.remove(), 120);
}

export function getDragImageOffset({ clientX, clientY, height, pieceRect, width }: DragImageOffsetInput) {
  const sourceWidth = pieceRect.width > 0 ? pieceRect.width : width;
  const sourceHeight = pieceRect.height > 0 ? pieceRect.height : height;
  const x = ((clientX - pieceRect.left) / sourceWidth) * width;
  const y = ((clientY - pieceRect.top) / sourceHeight) * height;
  return {
    x: clampDragOffset(x, width),
    y: clampDragOffset(y, height)
  };
}

function clampDragOffset(value: number, size: number) {
  if (!Number.isFinite(value)) return size / 2;
  return Math.max(0, Math.min(size, value));
}
