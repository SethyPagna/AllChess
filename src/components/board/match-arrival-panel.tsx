import { Clock3 } from "lucide-react";
import type { FriendRoomView } from "@/lib/realtime/friend-room";
import { pendingJanggiSide } from "@/lib/variants/janggi-formations";

export function MatchArrivalPanel({ room, connected, busy, error, onCancel, onFindAnother, onSetup, onReconnect }: {
  room: FriendRoomView;
  connected: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onFindAnother: () => void;
  onSetup: () => void;
  onReconnect: () => void;
}) {
  const arrival = room.arrival;
  if (!arrival) return null;
  const waiting = arrival.status === "waiting";
  const choosing = Boolean(pendingJanggiSide(room.janggiSetup));
  const heading = waiting ? choosing ? "Choose opening formations" : "Waiting for your opponent" : arrival.status === "expired" ? "Match expired" : "Match cancelled";
  return <section className="match-arrival-panel" aria-label="Match arrival">
    <div className="match-arrival-heading"><Clock3 size={16} aria-hidden="true" /><strong>{heading}</strong>
      {waiting && connected ? <span aria-label="Arrival time remaining">{Math.ceil(arrival.remainingMs / 1000)}s</span> : null}
    </div>
    <p>{!connected ? "Reconnecting to check this match…" : waiting ? choosing ? "Han chooses first, then Cho. Confirm before the countdown ends; game clocks are stopped." : "Your clock starts when both players arrive." : arrival.status === "expired" ? choosing ? "Setup wasn’t completed in time. No game was played." : "Both players didn’t connect in time. No game was played." : "No game was played. You can find someone else."}</p>
    {error ? <p role="status">{error}</p> : null}
    {!connected ? <button type="button" className="focus-ring action-secondary" onClick={onReconnect}>Reconnect now</button> : null}
    {room.seat ? <div className="match-arrival-actions">
      {waiting ? <button type="button" className="focus-ring action-secondary" disabled={!connected || busy} onClick={onCancel}>Cancel match</button> : <>
        <button type="button" className="focus-ring action-primary" disabled={!connected || busy} onClick={onFindAnother}>Find another opponent</button>
        <button type="button" className="focus-ring action-secondary" disabled={!connected || busy} onClick={onSetup}>Back to setup</button>
      </>}
    </div> : null}
  </section>;
}
