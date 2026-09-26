"use client";

import { Bell } from "lucide-react";
import { closeOtherShellMenus, useShellMenuDismissal } from "./menu-utils";

export function NotificationCenter() {
  const menuRef = useShellMenuDismissal();
  return (
    <details ref={menuRef} className="dropdown notification-menu relative inline-block" data-shell-menu="notifications" onToggle={(event) => {
      if (event.currentTarget.open) closeOtherShellMenus(event.currentTarget);
    }}>
      <summary aria-label="Notifications" title="Notifications" className="btn btn-square focus-ring action-secondary shell-icon-control cursor-pointer text-[var(--muted)]">
        <Bell aria-hidden="true" size={17} />
      </summary>
      <div className="dropdown-content notification-panel panel notification-empty">
        <strong>Notifications</strong>
        <Bell size={26} strokeWidth={1.5} aria-hidden="true" />
        <span>No notifications yet</span>
      </div>
    </details>
  );
}
