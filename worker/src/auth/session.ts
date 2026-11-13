import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Env, isDevEnv } from "../env";

// Sessions live in D1 (table "sessions") so they can be revoked. The cookie
// carries a random 256-bit token; the table stores only its SHA-256, so a
// leaked database does not hand out working cookies.

export const SESSION_COOKIE = "rentday_session";

const DAY = 24 * 60 * 60;
/** "Remember me": a persistent cookie that lasts this long. */
export const REMEMBER_SECONDS = 30 * DAY;
/** Otherwise: a browser-session cookie, and the server forgets it after this. */
export const SHORT_SESSION_SECONDS = 1 * DAY;

export interface SessionPayload {
  id: string;
  userName: string;
}

type Ctx = Context<{ Bindings: Env }>;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const hashToken = async (token: string): Promise<string> =>
  toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const createSession = async (
  c: Ctx,
  userId: string,
  remember: boolean
): Promise<void> => {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const now = nowSeconds();
  const lifetime = remember ? REMEMBER_SECONDS : SHORT_SESSION_SECONDS;

  await c.env.DB.batch([
    // tidy up this user's expired sessions while we are here
    c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?`).bind(userId, now),
    c.env.DB.prepare(
      `INSERT INTO sessions (id, user_id, expires_at, remember, created_at) VALUES (?, ?, ?, ?, ?)`
    ).bind(await hashToken(token), userId, now + lifetime, remember ? 1 : 0, new Date().toISOString()),
  ]);

  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !isDevEnv(c.env),
    sameSite: "Strict",
    path: "/",
    // no maxAge without "remember me": the browser drops it when it closes
    ...(remember ? { maxAge: lifetime } : {}),
  });
};

const currentToken = (c: Ctx): string | null => {
  const token = getCookie(c, SESSION_COOKIE);
  return token && TOKEN_PATTERN.test(token) ? token : null;
};

export const getSession = async (c: Ctx): Promise<SessionPayload | null> => {
  const token = currentToken(c);
  if (!token) {
    return null;
  }
  const row = await c.env.DB.prepare(
    `SELECT s.user_id AS id, u.username AS userName
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?`
  )
    .bind(await hashToken(token), nowSeconds())
    .first<SessionPayload>();
  return row ?? null;
};

/** Log out this browser: revoke its session and drop the cookie. */
export const endSession = async (c: Ctx): Promise<void> => {
  const token = currentToken(c);
  if (token) {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(await hashToken(token)).run();
  }
  clearSessionCookie(c);
};

/** Log out everywhere: revoke every session the user has. */
export const endAllSessions = async (c: Ctx, userId: string): Promise<void> => {
  await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
  clearSessionCookie(c);
};

export const clearSessionCookie = (c: Ctx): void => {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: !isDevEnv(c.env) });
};
