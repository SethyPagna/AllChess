"use client";

import { Bell, CheckCircle2, Radio, Sparkles } from "lucide-react";

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
    title: "No fake alerts",
    detail: "AllChess only shows real account, room, and analysis events.",
    Icon: Sparkles
  }
];

export function NotificationCenter() {
  return (
    <details className="notification-menu relative inline-block">
      <summary aria-label="Notifications" title="Notifications" className="focus-ring action-secondary grid h-10 w-10 cursor-pointer list-none place-items-center text-[var(--muted)]">
        <Bell aria-hidden="true" size={17} />
        <span className="notification-dot" aria-hidden="true" />
      </summary>
      <div className="notification-panel panel absolute right-0 top-12 z-40 grid w-80 max-w-[calc(100vw-1rem)] gap-2 p-2 shadow-xl">
        <div className="notification-panel-heading">
          <strong>Notifications</strong>
          <span>Live events</span>
        </div>
        {notifications.map(({ title, detail, Icon }) => (
          <div key={title} className="notification-row">
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
