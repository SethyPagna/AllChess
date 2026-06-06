"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
    body: "Player room ready.",
    channel: "players",
    createdAt: "now",
    tone: "system"
  },
  {
    id: "players-opponent",
    author: "Opponent",
    body: "Private 1v1 chat.",
    channel: "players",
    createdAt: "now",
    tone: "opponent"
  },
  {
    id: "public-ready",
    author: "Watch",
    body: "Public room ready.",
    channel: "public",
    createdAt: "now",
    tone: "system"
  },
  {
    id: "public-spectators",
    author: "Spectators",
    body: "Everyone watching can join.",
    channel: "public",
    createdAt: "now",
    tone: "spectator"
  }
];

export function PlayChatPanel({ gameStarted, isSpectating, playMode, title }: PlayChatPanelProps) {
  const inputHelpId = useId();
  const preferredChannel: ChatChannel = isSpectating || playMode === "spectate" ? "public" : "players";
  const playerChatLocked = preferredChannel === "public";
  const [activeChannel, setActiveChannel] = useState<ChatChannel>(preferredChannel);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const messageSequence = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const resolvedChannel: ChatChannel = playerChatLocked && activeChannel === "players" ? "public" : activeChannel;
  const visibleMessages = useMemo(() => messages.filter((message) => message.channel === resolvedChannel), [messages, resolvedChannel]);
  const channelCounts = useMemo(
    () =>
      messages.reduce<Record<ChatChannel, number>>(
        (counts, message) => {
          counts[message.channel] += 1;
          return counts;
        },
        { players: 0, public: 0 }
      ),
    [messages]
  );
  const channelLabel = resolvedChannel === "players" ? "Players" : "Public";
  const placeholder = resolvedChannel === "players" ? "Message player room" : "Message public room";
  const channelSummary = resolvedChannel === "players" ? "Private 1v1 room" : "Spectator room";

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [visibleMessages]);

  function sendMessage() {
    const body = draft.trim();
    if (!body) return;
    messageSequence.current += 1;
    setMessages((current) => [
      ...current,
      {
        id: `${resolvedChannel}-${Date.now()}-${messageSequence.current}`,
        author: "You",
        body,
        channel: resolvedChannel,
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
          <button
            type="button"
            className="focus-ring"
            role="tab"
            aria-selected={resolvedChannel === "players"}
            aria-disabled={playerChatLocked}
            disabled={playerChatLocked}
            data-active={resolvedChannel === "players" ? "true" : undefined}
            title={playerChatLocked ? "Player chat is available in playable rooms" : "Open player chat"}
            onClick={() => setActiveChannel("players")}
          >
            <Users size={14} />
            <span>Players</span>
            <b>{channelCounts.players}</b>
          </button>
          <button type="button" className="focus-ring" role="tab" aria-selected={resolvedChannel === "public"} data-active={resolvedChannel === "public" ? "true" : undefined} onClick={() => setActiveChannel("public")}>
            <Radio size={14} />
            <span>Public</span>
            <b>{channelCounts.public}</b>
          </button>
        </div>
      </div>
      <div className="play-chat-context" aria-live="polite">
        <strong>{channelSummary}</strong>
        <span>{gameStarted ? "Live" : "Setup"}</span>
      </div>
      <div ref={logRef} className="play-chat-log" role="log" aria-live="polite" aria-label={`${channelLabel} chat messages`}>
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
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} maxLength={180} aria-describedby={inputHelpId} />
        </label>
        <small id={inputHelpId} className="sr-only">
          Messages are limited to 180 characters.
        </small>
        <button type="submit" className="focus-ring" aria-label={`Send ${channelLabel.toLowerCase()} chat message`} disabled={!draft.trim()}>
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
