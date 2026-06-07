import type { DragEvent } from "react";

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

  event.dataTransfer.setDragImage(dragImage, width / 2, height / 2);
  window.setTimeout(() => dragImage.remove(), 120);
}
