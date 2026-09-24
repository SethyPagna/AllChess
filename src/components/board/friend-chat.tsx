"use client";
import { useState } from "react";
import { Send } from "lucide-react";
import type { FriendRoomView } from "@/lib/realtime/friend-room";

export function FriendChat({ room, busy, onSend }: { room: FriendRoomView | null; busy: boolean; onSend: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  return <details className="studio-chat-disclosure"><summary>Friend chat <span>{room?.messages?.length ? `${room.messages.length} messages` : "Private to the two players"}</span></summary><div className="friend-chat-log" role="log" aria-label="Friend messages">{room?.messages?.map(message => <p key={message.id}><strong>{message.color === room.seat ? "You" : "Friend"}</strong><span>{message.text}</span></p>)}{!room?.messages?.length ? <p>Say hello to your friend.</p> : null}</div><form className="friend-chat-form" onSubmit={async event => { event.preventDefault(); if (text.trim() && await onSend(text.trim())) setText(""); }}><input aria-label="Message your friend" value={text} maxLength={280} placeholder="Your message…" onChange={event => setText(event.target.value)} disabled={!room?.seat} /><button type="submit" className="focus-ring action-secondary" aria-label="Send to friend" disabled={!text.trim() || busy || !room?.seat}><Send size={16} /></button></form></details>;
}
