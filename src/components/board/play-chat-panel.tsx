"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, Radio, Send, Users } from "lucide-react";

import type { PlayMode } from "@/components/board/game-board-options";
import { watchHref } from "@/lib/routing/watch-links";

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
  locale: string;
  playMode: PlayMode;
  roomId: string;
  title: string;
  variantKey: string;
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

export function PlayChatPanel({ gameStarted, isSpectating, locale, playMode, roomId, title, variantKey }: PlayChatPanelProps) {
  const inputHelpId = useId();
  const preferredChannel: ChatChannel = isSpectating || playMode === "spectate" ? "public" : "players";
  const playerChatLocked = preferredChannel === "public";
  const storageKey = `allchess-chat:${roomId}`;
  const [activeChannel, setActiveChannel] = useState<ChatChannel>(preferredChannel);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const messageSequence = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const storageLoadedRef = useRef(false);
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
  const watchRoomHref = watchHref(locale, { q: roomId, variant: variantKey });

  useEffect(() => {
    storageLoadedRef.current = false;
    window.queueMicrotask(() => {
      let nextMessages: ChatMessage[] | null = null;
      let loaded = false;
      try {
        const stored = window.localStorage.getItem(storageKey);
        nextMessages = stored ? (JSON.parse(stored) as ChatMessage[]) : null;
        loaded = true;
      } catch {
        nextMessages = seedMessages;
        loaded = true;
      }
      if (nextMessages) setMessages(nextMessages);
      storageLoadedRef.current = loaded;
    });
  }, [storageKey]);

  useEffect(() => {
    if (!storageLoadedRef.current) return;
    window.localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [visibleMessages]);

  useEffect(() => {
    function syncFromStorage(event: StorageEvent) {
      if (event.key !== storageKey || !event.newValue) return;
      try {
        setMessages(JSON.parse(event.newValue) as ChatMessage[]);
      } catch {
        setMessages(seedMessages);
      }
    }
    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, [storageKey]);

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
        <Link href={watchRoomHref as never} className="focus-ring" title={`Find ${roomId} in watch rooms`}>
          {gameStarted || playMode === "spectate" ? "Watch" : "Setup"}
        </Link>
      </div>
      <p className="play-chat-room-meta">
        <span>{variantKey}</span>
        <code>{roomId}</code>
      </p>
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
