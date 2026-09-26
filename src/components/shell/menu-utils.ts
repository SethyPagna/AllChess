export function closeOtherShellMenus(currentMenu: HTMLDetailsElement) {
  document.querySelectorAll<HTMLDetailsElement>("details[data-shell-menu]").forEach((menu) => {
    if (menu !== currentMenu) {
      menu.open = false;
    }
  });
}
import { useEffect, useRef } from "react";

export function useShellMenuDismissal() {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      const menu = ref.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    };
    const dismissEscape = (event: KeyboardEvent) => {
      const menu = ref.current;
      if (event.key !== "Escape" || !menu?.open) return;
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
  }, []);

  return ref;
}
