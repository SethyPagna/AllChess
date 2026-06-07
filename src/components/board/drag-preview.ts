import type { DragEvent } from "react";

export function setPieceDragImage(event: DragEvent<HTMLElement>) {
  const piece = event.currentTarget.querySelector<HTMLElement>(".piece-icon");
  if (!piece) return;

  const dragImage = document.createElement("span");
  dragImage.className = "piece-drag-preview";
  dragImage.setAttribute("aria-hidden", "true");
  dragImage.appendChild(piece.cloneNode(true));
  document.body.appendChild(dragImage);

  const size = Math.max(44, Math.min(76, event.currentTarget.getBoundingClientRect().width * 0.72));
  dragImage.style.width = `${size}px`;
  dragImage.style.height = `${size}px`;
  event.dataTransfer.setDragImage(dragImage, size / 2, size / 2);
  window.setTimeout(() => dragImage.remove(), 0);
}
