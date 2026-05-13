import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const sessionCookieName = "allchess_session";

const encoder = new TextEncoder();
const iterations = 120000;
const saltBytes = 16;
const keyLength = 32;

export type SessionCookie = {
  name: string;
  value: string;
  options: Partial<ResponseCookie>;
};

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(saltBytes));
  const key = await derivePasswordKey(password, salt);
  return `pbkdf2-sha256$${iterations}$${toBase64(salt)}$${toBase64(key)}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationValue, saltValue, hashValue] = storedHash.split("$");
  if (algorithm !== "pbkdf2-sha256" || !iterationValue || !saltValue || !hashValue) return false;

  const salt = fromBase64(saltValue);
  const expected = fromBase64(hashValue);
  const actual = await derivePasswordKey(password, salt, Number(iterationValue));
  return timingSafeEqual(actual, expected);
}

export function createSessionCookie(sessionId: string, maxAgeSeconds: number): SessionCookie {
  return {
    name: sessionCookieName,
    value: sessionId,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSeconds
    }
  };
}

export function createExpiredSessionCookie(): SessionCookie {
  return createSessionCookie("", 0);
}

export function createSessionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

async function derivePasswordKey(password: string, salt: Uint8Array, iterationCount = iterations) {
  const passwordKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBuffer,
      iterations: iterationCount
    },
    passwordKey,
    keyLength * 8
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index] ^ b[index];
  }
  return diff === 0;
}

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
}
