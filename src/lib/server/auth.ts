import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getDb } from "./db";

/**
 * Minimal, deliberately email-free account system (data minimization: we
 * store a username and a scrypt password hash, nothing else). Sessions are
 * random 256-bit tokens stored only as SHA-256 hashes; the browser holds
 * the raw token in an httpOnly, SameSite=Lax cookie.
 *
 * Known trade-off, documented in the README: with no email on file there is
 * no password reset. An admin can delete an account so the name can be
 * re-registered.
 */

export interface SessionUser {
  id: number;
  username: string;
  role: "user" | "admin";
}

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "fw_session";

export const USERNAME_RE = /^[a-z0-9_-]{3,24}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, SCRYPT);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, SCRYPT);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isAdmin(username: string): boolean {
  return (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(username);
}

export function createUser(username: string, password: string): SessionUser | "taken" {
  const db = getDb();
  const uname = username.toLowerCase();
  try {
    const info = db
      .prepare("INSERT INTO users (username, pass, role, created_at) VALUES (?, ?, ?, ?)")
      .run(uname, hashPassword(password), isAdmin(uname) ? "admin" : "user", Date.now());
    return { id: Number(info.lastInsertRowid), username: uname, role: isAdmin(uname) ? "admin" : "user" };
  } catch {
    return "taken";
  }
}

export function checkCredentials(username: string, password: string): SessionUser | null {
  const db = getDb();
  const row = db
    .prepare("SELECT id, username, pass, role FROM users WHERE username = ?")
    .get(username.toLowerCase()) as
    | { id: number; username: string; pass: string; role: "user" | "admin" }
    | undefined;
  // Always burn a hash even for unknown users so timing doesn't leak existence.
  const stored = row?.pass ?? hashPassword("timing-equalizer");
  const ok = verifyPassword(password, stored);
  if (!row || !ok) return null;
  const role = isAdmin(row.username) ? "admin" : row.role;
  return { id: row.id, username: row.username, role };
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString("hex");
  getDb()
    .prepare("INSERT INTO sessions (token_hash, user_id, expires) VALUES (?, ?, ?)")
    .run(tokenHash(token), userId, Date.now() + SESSION_TTL_MS);
  return token;
}

export function destroySession(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
}

export function sessionCookie(token: string, maxAgeSeconds = SESSION_TTL_MS / 1000): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeSeconds)}${secure}`;
}

export function readSessionToken(req: Request): string | null {
  const cookies = req.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=") || null;
  }
  return null;
}

export function getSessionUser(req: Request): SessionUser | null {
  const token = readSessionToken(req);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.role, s.expires FROM sessions s
       JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`
    )
    .get(tokenHash(token)) as
    | { id: number; username: string; role: "user" | "admin"; expires: number }
    | undefined;
  if (!row) return null;
  if (row.expires < Date.now()) {
    destroySession(token);
    return null;
  }
  const role = isAdmin(row.username) ? "admin" : row.role;
  return { id: row.id, username: row.username, role };
}

/**
 * CSRF guard for mutating requests: browsers attach an Origin header to
 * cross-site (and same-origin fetch) POSTs; if one is present it must match
 * the request host. SameSite=Lax on the session cookie is the first line of
 * defence — this is belt-and-braces.
 */
export function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}
