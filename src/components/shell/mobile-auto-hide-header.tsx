"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export function MobileAutoHideHeader({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const onScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY.current + 10;
      const scrollingUp = currentScrollY < lastScrollY.current - 10;
      const menuOpen = Boolean(document.querySelector(".app-mobile-header details[open], .app-mobile-header .language-menu[open], .app-mobile-header .notification-menu[open]"));

      if (menuOpen || currentScrollY < 32) {
        setHidden(false);
      } else if (scrollingDown) {
        setHidden(true);
      } else if (scrollingUp) {
        setHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return <header className={`app-mobile-header ${hidden ? "is-hidden" : ""}`}>{children}</header>;
}
