import { decodeLocalMatch, encodeLocalMatch, type LocalMatchRecord, type LocalMatchSnapshot, type LocalMatchSummary } from "./local-match";

const databaseName = "allchess-local-matches";
const storeName = "matches";
const changeEvent = "allchess-local-matches-changed";
let database: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(storeName, { keyPath: "id" }).createIndex("updatedAt", "updatedAt"); };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = null; };
      resolve(request.result);
    };
    request.onerror = () => { database = null; reject(request.error); };
    request.onblocked = () => { database = null; reject(new Error("Close other AllChess windows and try saving again.")); };
  });
  return database;
}

function announce(id: string) {
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: id }));
  if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel(changeEvent); channel.postMessage(id); channel.close(); }
}

export function subscribeLocalMatches(listener: () => void) {
  window.addEventListener(changeEvent, listener);
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(changeEvent) : null;
  if (channel) channel.onmessage = listener;
  return () => { window.removeEventListener(changeEvent, listener); channel?.close(); };
}

export async function listLocalMatches(variantKey?: string): Promise<LocalMatchSummary[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).index("updatedAt").openCursor(null, "prev");
    const rows: LocalMatchSummary[] = [];
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || rows.length >= 100) { resolve(rows); return; }
      const value = cursor.value as LocalMatchRecord;
      if (value.version === 1 && (!variantKey || value.variantKey === variantKey)) {
        rows.push({ id: value.id, variantKey: value.variantKey, updatedAt: value.updatedAt, revision: value.revision, ply: value.ply, completed: value.completed, mode: value.mode });
      }
      cursor.continue();
    };
  });
}

export async function readLocalMatch(id: string) {
  const db = await openDatabase();
  const record = await new Promise<LocalMatchRecord | undefined>((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  if (!record) throw new Error("This saved match is no longer on this device.");
  const snapshot = decodeLocalMatch(record);
  if (!snapshot) throw new Error("This saved match could not be opened. It has been kept on your device.");
  return { snapshot, revision: record.revision };
}

export class LocalMatchConflict extends Error {
  constructor() { super("This match changed in another window. Open its latest save or keep your board as a separate copy."); }
}

export async function writeLocalMatch(snapshot: LocalMatchSnapshot, expectedRevision: number): Promise<number> {
  const payload = encodeLocalMatch(snapshot), db = await openDatabase();
  let revision = expectedRevision + 1; let changed = true;
  // The read and write share a transaction: two tabs cannot overwrite each
  // other's revision, and a quota failure leaves the last complete record intact.
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite"), store = transaction.objectStore(storeName);
    let conflict = false; let failure: unknown;
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(conflict ? new LocalMatchConflict() : failure ?? transaction.error ?? new Error("Could not save on this device."));
    const request = store.get(snapshot.state.id);
    request.onsuccess = () => {
      if ((request.result?.revision ?? 0) !== expectedRevision) { conflict = true; transaction.abort(); return; }
      if (request.result?.payload === payload) { revision = expectedRevision; changed = false; return; }
      try { store.put({ version: 1, id: snapshot.state.id, variantKey: snapshot.state.variantKey, updatedAt: Date.now(), revision, ply: snapshot.state.ply, completed: snapshot.state.status === "completed", mode: snapshot.settings.playMode, payload } satisfies LocalMatchRecord); } catch (cause) { failure = cause; transaction.abort(); }
    };
  });
  if (changed) announce(snapshot.state.id); return revision;
}

export async function removeLocalMatch(id: string, expectedRevision: number) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite"), store = transaction.objectStore(storeName); let conflict = false;
    transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(conflict ? new LocalMatchConflict() : transaction.error);
    const request = store.get(id);
    request.onsuccess = () => { if (request.result && request.result.revision !== expectedRevision) { conflict = true; transaction.abort(); } else store.delete(id); };
  });
  announce(id);
}
