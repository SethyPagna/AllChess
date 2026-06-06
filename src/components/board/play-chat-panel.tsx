"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Radio, Send, Users } from "lucide-react";

import type { PlayMode } from "@/components/board/game-board-options";

type ChatChannel = "players" | "public";

type ChatMessage = {
  id: string;
  author: string;
  body: string;
  channel: ChatChannel;
  createdAt: string;
  tone: "system" | "user" | "opponent" | "spectator";
};

type PlayChatPanelProps = {
  gameStarted: boolean;
  isSpectating: boolean;
  playMode: PlayMode;
  title: string;
};

const seedMessages: ChatMessage[] = [
  {
    id: "players-ready",
    author: "Room",
    body: "Player chat ready.",
    channel: "players",
    createdAt: "now",
    tone: "system"
  },
  {
    id: "public-ready",
    author: "Watch",
    body: "Public chat ready.",
    channel: "public",
    createdAt: "now",
    tone: "system"
  }
];

export function PlayChatPanel({ gameStarted, isSpectating, playMode, title }: PlayChatPanelProps) {
  const preferredChannel: ChatChannel = isSpectating || playMode === "spectate" ? "public" : "players";
  const [activeChannel, setActiveChannel] = useState<ChatChannel>(preferredChannel);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const visibleMessages = useMemo(() => messages.filter((message) => message.channel === activeChannel), [activeChannel, messages]);
  const channelLabel = activeChannel === "players" ? "Players" : "Public";
  const placeholder = activeChannel === "players" ? "Message player room" : "Message public room";

  function sendMessage() {
    const body = draft.trim();
    if (!body) return;
    setMessages((current) => [
      ...current,
      {
        id: `${activeChannel}-${Date.now()}`,
        author: "You",
        body,
        channel: activeChannel,
        createdAt: gameStarted ? "live" : "setup",
        tone: "user"
      }
    ]);
    setDraft("");
  }

  return (
    <section className="play-chat-panel play-table-card" aria-label={`${title} chat room`}>
      <div className="play-chat-header">
        <span>
          <MessageCircle size={16} />
          Chat
        </span>
        <div className="play-chat-channels" role="tablist" aria-label="Chat channel">
          <button type="button" className="focus-ring" role="tab" aria-selected={activeChannel === "players"} data-active={activeChannel === "players" ? "true" : undefined} onClick={() => setActiveChannel("players")}>
            <Users size={14} />
            Players
          </button>
          <button type="button" className="focus-ring" role="tab" aria-selected={activeChannel === "public"} data-active={activeChannel === "public" ? "true" : undefined} onClick={() => setActiveChannel("public")}>
            <Radio size={14} />
            Public
          </button>
        </div>
      </div>
      <div className="play-chat-log" role="log" aria-live="polite" aria-label={`${channelLabel} chat messages`}>
        {visibleMessages.map((message) => (
          <p key={message.id} className="play-chat-message" data-tone={message.tone}>
            <span>{message.author}</span>
            <strong>{message.body}</strong>
            <small>{message.createdAt}</small>
          </p>
        ))}
      </div>
      <form
        className="play-chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
      >
        <label>
          <span className="sr-only">{placeholder}</span>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} maxLength={180} />
        </label>
        <button type="submit" className="focus-ring" aria-label={`Send ${channelLabel.toLowerCase()} chat message`} disabled={!draft.trim()}>
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
