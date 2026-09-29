import { afterEach, describe, expect, test, vi } from "vitest";
import { createOfflinePackClient } from "@/components/shell/offline-pack";

type Status = Parameters<Parameters<typeof createOfflinePackClient>[1]>[0];

class Events {
  listeners = new Map<string, Set<() => void>>();
  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: () => void) { this.listeners.get(type)?.delete(listener); }
  emit(type: string) { [...(this.listeners.get(type) ?? [])].forEach(listener => listener()); }
  get listenerCount() { return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0); }
}

class Port {
  peer!: Port;
  onmessage: ((event: { data: Status }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  closed = false;
  close() { this.closed = true; }
  postMessage(data: Status) { if (!this.peer.closed) this.peer.onmessage?.({ data }); }
}

class Channel {
  port1 = new Port();
  port2 = new Port();
  constructor() { this.port1.peer = this.port2; this.port2.peer = this.port1; }
}

class Worker extends Events {
  state: ServiceWorkerState = "activated";
  messages: { type: string; port: Port }[] = [];
  postMessage(data: { type: string }, ports: Port[]) { this.messages.push({ type: data.type, port: ports[0] }); }
  change(state: ServiceWorkerState) { this.state = state; this.emit("statechange"); }
  get downloads() { return this.messages.filter(message => message.type === "DOWNLOAD_OFFLINE"); }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

function harness() {
  vi.stubGlobal("MessageChannel", Channel);
  const original = new Worker();
  const registration = Object.assign(new Events(), {
    active: original,
    installing: null as Worker | null,
    waiting: null as Worker | null,
    update: vi.fn(async () => {})
  });
  const workers = Object.assign(new Events(), { register: vi.fn(async () => registration) });
  const statuses: Status[] = [];
  const available = vi.fn();
  const client = createOfflinePackClient(workers as unknown as ServiceWorkerContainer, status => statuses.push(status), available);
  const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
  const latest = () => statuses.at(-1)!;
  async function ready() {
    await flush();
    original.messages.find(message => message.type === "OFFLINE_STATUS")!.port.postMessage({ ready: true });
  }
  return { original, registration, workers, client, statuses, available, flush, latest, ready };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("offline pack client lifecycle", () => {
  test("controller changes and queued old status replies cannot replace an active download", async () => {
    const h = harness(); await h.ready();
    const oldReply = h.original.messages[0].port.peer.onmessage!;
    const download = h.client.download(); await h.flush();
    const transfer = h.original.downloads[0].port;
    transfer.postMessage({ ready: true, downloading: true, completed: 10, total: 100 });
    const replacement = new Worker(); h.registration.active = replacement;
    h.workers.emit("controllerchange");
    oldReply({ data: { ready: true } }); await h.flush();
    expect(h.latest()).toEqual({ ready: true, downloading: true, completed: 10, total: 100 });
    expect(transfer.peer.closed).toBe(false);
    expect(replacement.messages).toEqual([]);
    transfer.postMessage({ ready: true }); await download;
    expect(h.latest()).toEqual({ ready: true });
    expect(h.original.downloads).toHaveLength(1);
    h.client.dispose();
  });

  test("an old installed pack waits for the new worker to activate before downloading", async () => {
    const h = harness(); await h.ready();
    const updated = new Worker(); updated.state = "installing";
    h.registration.update.mockImplementation(async () => { h.registration.installing = updated; });
    const download = h.client.download(); await h.flush();
    expect(h.registration.update).toHaveBeenCalledOnce();
    expect(h.original.downloads).toEqual([]); expect(updated.downloads).toEqual([]);
    h.registration.installing = null; h.registration.waiting = updated; updated.change("installed");
    expect(updated.downloads).toEqual([]);
    h.registration.waiting = null; h.registration.active = updated; updated.change("activated");
    h.workers.emit("controllerchange"); await h.flush();
    expect(updated.downloads).toHaveLength(1);
    expect(h.original.downloads).toEqual([]);
    updated.downloads[0].port.postMessage({ ready: true }); await download;
    expect(updated.listenerCount).toBe(0);
    h.client.dispose();
  });

  test("failed updates preserve prior readiness and a late failed-job reply cannot overwrite a retry", async () => {
    const h = harness(); await h.ready();
    const first = h.client.download(); await h.flush();
    const failedReply = h.original.downloads[0].port.peer.onmessage!;
    failedReply({ data: { ready: true, error: "The app changed during download. Please try again." } });
    await first;
    expect(h.latest()).toEqual({ ready: true, error: "The app changed during download. Please try again." });
    h.workers.emit("controllerchange"); await h.flush();
    h.original.messages.at(-1)!.port.postMessage({ ready: true });
    expect(h.latest().error).toBe("The app changed during download. Please try again.");
    const second = h.client.download(); await h.flush();
    failedReply({ data: { ready: true } });
    expect(h.latest().downloading).toBe(true);
    h.original.downloads[1].port.postMessage({ ready: true }); await second;
    expect(h.latest()).toEqual({ ready: true });
    h.client.dispose();
  });

  test("worker preparation times out without sending to the old worker", async () => {
    vi.useFakeTimers(); const h = harness(); await h.ready();
    const updated = new Worker(); updated.state = "installing";
    h.registration.update.mockImplementation(async () => { h.registration.installing = updated; });
    const download = h.client.download(); await h.flush();
    await vi.advanceTimersByTimeAsync(30_000); await download;
    expect(h.latest()).toMatchObject({ ready: true, downloading: false, error: expect.stringContaining("too long") });
    expect(h.original.downloads).toEqual([]); expect(updated.downloads).toEqual([]);
    expect(updated.listenerCount).toBe(0);
    h.client.dispose(); expect(h.workers.listenerCount).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });

  test("an active slow download is not cut off by the worker preparation timeout", async () => {
    vi.useFakeTimers(); const h = harness(); await h.ready();
    const download = h.client.download(); await h.flush();
    const transfer = h.original.downloads[0].port;
    transfer.postMessage({ ready: true, downloading: true, completed: 1, total: 100 });
    await vi.advanceTimersByTimeAsync(180_000);
    expect(h.latest().downloading).toBe(true); expect(transfer.peer.closed).toBe(false);
    transfer.postMessage({ ready: true }); await download; h.client.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each(["update", "activation", "download"] as const)("unmount during %s removes listeners and ignores late results", async phase => {
    vi.useFakeTimers(); const h = harness(); await h.ready();
    const waiting = deferred();
    const updated = new Worker(); updated.state = "installing";
    if (phase === "update") h.registration.update.mockImplementation(() => waiting.promise);
    if (phase === "activation") h.registration.update.mockImplementation(async () => { h.registration.installing = updated; });
    const download = h.client.download(); await h.flush();
    const staleReply = h.original.downloads[0]?.port.peer.onmessage;
    const count = h.statuses.length;
    h.client.dispose(); waiting.resolve(); updated.change("activated");
    staleReply?.({ data: { ready: true } }); await download;
    expect(h.statuses).toHaveLength(count);
    expect(h.original.downloads).toHaveLength(phase === "download" ? 1 : 0);
    expect(h.workers.listenerCount).toBe(0); expect(updated.listenerCount).toBe(0);
    expect(h.original.messages.every(message => message.port.peer.closed)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("failed activation keeps the previous pack available and permits retry", async () => {
    const h = harness(); await h.ready();
    const updated = new Worker(); updated.state = "installing";
    h.registration.update.mockImplementation(async () => { h.registration.installing = updated; });
    const download = h.client.download(); await h.flush();
    h.registration.installing = null; updated.change("redundant"); await download;
    expect(h.latest()).toMatchObject({ ready: true, downloading: false, error: expect.stringContaining("could not finish") });
    expect(h.original.downloads).toEqual([]);
    h.client.dispose();
  });
});
