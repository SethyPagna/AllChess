"use client";

import { Bell, CheckCircle2, Radio, Sparkles } from "lucide-react";
import { useState } from "react";

const notifications = [
  {
    title: "Match ready",
    detail: "Your next queue or room update appears here.",
    Icon: Radio
  },
  {
    title: "Review complete",
    detail: "Game review and bot notes will surface when available.",
    Icon: CheckCircle2
  },
  {
    title: "Real alerts only",
    detail: "Account, room, and review events appear only when they exist.",
    Icon: Sparkles
  }
];

export function NotificationCenter() {
  const [read, setRead] = useState(false);
  const unreadCount = read ? 0 : notifications.length;

  return (
    <details className="notification-menu relative inline-block">
      <summary
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        title={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
        className="focus-ring action-secondary grid h-10 w-10 cursor-pointer list-none place-items-center text-[var(--muted)]"
      >
        <Bell aria-hidden="true" size={17} />
        {unreadCount ? <span className="notification-dot" aria-hidden="true" /> : null}
      </summary>
      <div className="notification-panel panel absolute right-0 top-12 z-40 grid w-80 max-w-[calc(100vw-1rem)] gap-2 p-2 shadow-xl">
        <div className="notification-panel-heading">
          <span>
            <strong>Notifications</strong>
            <small>{unreadCount ? `${unreadCount} unread` : "All caught up"}</small>
          </span>
          <button type="button" className="focus-ring notification-read-button" onClick={() => setRead(true)} disabled={!unreadCount}>
            Mark read
          </button>
        </div>
        {notifications.map(({ title, detail, Icon }) => (
          <div key={title} className="notification-row" data-read={read ? "true" : "false"}>
            <Icon aria-hidden="true" size={16} />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}
