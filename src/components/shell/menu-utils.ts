import { useEffect, useRef } from "react";

export function closeOtherShellMenus(currentMenu: HTMLDetailsElement) {
  document.querySelectorAll<HTMLDetailsElement>("details[data-shell-menu]").forEach((menu) => {
    if (menu !== currentMenu) {
      menu.open = false;
    }
  });
}

/** Closes the menu on an outside pointerdown or Escape. `ignore` matches portaled panels that belong to the menu. */
export function useShellMenuDismissal(ignore?: string) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const isIgnored = (target: EventTarget | null) => Boolean(ignore && target instanceof Element && target.closest(ignore));
    const dismissOutside = (event: PointerEvent) => {
      const menu = ref.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target) && !isIgnored(event.target)) menu.open = false;
    };
    const dismissEscape = (event: KeyboardEvent) => {
      const menu = ref.current;
      if (event.key !== "Escape" || !menu?.open || isIgnored(event.target)) return;
      menu.open = false;
      menu.querySelector("summary")?.focus();
      event.preventDefault();
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [ignore]);

  return ref;
}
