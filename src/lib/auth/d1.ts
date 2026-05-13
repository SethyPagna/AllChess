import type { D1Database } from "@cloudflare/workers-types";

import { createSessionId, hashPassword, verifyPassword } from "./session";

const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

export type AuthResult =
  | { ok: true; sessionId: string; maxAge: number; profileId: string }
  | { ok: false; error: string };

export async function signInWithD1(db: D1Database, email: string, password: string): Promise<AuthResult> {
  const account = await db
    .prepare("select id, profile_id, password_hash from accounts where email = ? and provider = 'password'")
    .bind(email.toLowerCase())
    .first<{ id: string; profile_id: string; password_hash: string }>();

  if (!account || !(await verifyPassword(password, account.password_hash))) {
    return { ok: false, error: "Invalid email or password." };
  }

  return createSession(db, account.profile_id);
}

export async function signUpWithD1(db: D1Database, email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase();
  const existing = await db.prepare("select id from accounts where email = ?").bind(normalizedEmail).first<{ id: string }>();
  if (existing) return { ok: false, error: "An account already exists for this email." };

  const profileId = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const username = normalizedEmail.split("@")[0]?.replace(/[^a-z0-9_-]/gi, "").slice(0, 20) || `player-${profileId.slice(0, 8)}`;
  const passwordHash = await hashPassword(password);

  await db
    .prepare("insert into profiles (id, username, display_name) values (?, ?, ?)")
    .bind(profileId, username, username)
    .run();
  await db
    .prepare("insert into accounts (id, profile_id, provider, email, password_hash) values (?, ?, 'password', ?, ?)")
    .bind(accountId, profileId, normalizedEmail, passwordHash)
    .run();

  return createSession(db, profileId);
}

export async function createGuestSessionWithD1(db: D1Database): Promise<AuthResult> {
  const profileId = crypto.randomUUID();
  const displayName = `Guest ${profileId.slice(0, 4).toUpperCase()}`;
  await db
    .prepare("insert into profiles (id, username, display_name, is_guest) values (?, ?, ?, 1)")
    .bind(profileId, `guest-${profileId.slice(0, 12)}`, displayName)
    .run();
  return createSession(db, profileId);
}

async function createSession(db: D1Database, profileId: string): Promise<AuthResult> {
  const sessionId = createSessionId();
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString();
  await db
    .prepare("insert into sessions (id, profile_id, expires_at) values (?, ?, ?)")
    .bind(sessionId, profileId, expiresAt)
    .run();
  return { ok: true, sessionId, maxAge: sessionMaxAgeSeconds, profileId };
}
