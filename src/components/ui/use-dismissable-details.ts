"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes a native <details> popover on Escape (returning focus to its summary), on a pointer press
 * outside it, or when keyboard focus moves to something outside it.
 */
export function useDismissableDetails(ref: RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const details = ref.current;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (event.target instanceof Node && ref.current?.open && !ref.current.contains(event.target)) ref.current.open = false;
    }
    // A null relatedTarget (Safari, clicks on non-focusable areas) is left to the pointer handler,
    // so a link click inside the panel is never cut off by an early close.
    function onFocusOut(event: FocusEvent) {
      if (ref.current?.open && event.relatedTarget instanceof Node && !ref.current.contains(event.relatedTarget)) ref.current.open = false;
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    details?.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      details?.removeEventListener("focusout", onFocusOut);
    };
  }, [ref]);
}

/** Closes the popover; with restoreFocus, focus returns to its summary (when it is still mounted). */
export function closeDetails(ref: RefObject<HTMLDetailsElement | null>, { restoreFocus = false }: { restoreFocus?: boolean } = {}) {
  if (!ref.current) return;
  ref.current.open = false;
  if (restoreFocus) ref.current.querySelector("summary")?.focus();
}
