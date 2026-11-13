import type { Context } from "hono";
import { Env, isDevEnv } from "../env";

type Ctx = Context<{ Bindings: Env }>;

// Two layers against password guessing and sign-up floods:
//  1. per-IP limits from Cloudflare's Rate Limiting binding (cheap, checked
//     before any password hashing; off in development unless DEV_RATE_LIMIT)
//  2. per-email lockout in D1: after MAX_FAILURES wrong passwords within
//     LOCKOUT_WINDOW_SECONDS, that address cannot log in until the window ends.
//     This one holds even when the guesses come from many IPs.

export const MAX_FAILURES = 10;
export const LOCKOUT_WINDOW_SECONDS = 15 * 60;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const clientIp = (c: Ctx): string =>
  c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0].trim() ?? "unknown";

/** True when this IP may go ahead; false when it is over the limit. */
export const allowByIp = async (
  c: Ctx,
  limiter: RateLimit | undefined,
  action: "login" | "signup"
): Promise<boolean> => {
  if (!limiter || (isDevEnv(c.env) && c.env.DEV_RATE_LIMIT !== "true")) {
    return true;
  }
  const { success } = await limiter.limit({ key: `${action}:${clientIp(c)}` });
  return success;
};

/** Seconds until the email may try again, or 0 when it is not locked. */
export const lockedForSeconds = async (c: Ctx, email: string): Promise<number> => {
  const row = await c.env.DB.prepare(`SELECT count, window_start FROM login_failures WHERE email = ?`)
    .bind(email)
    .first<{ count: number; window_start: number }>();
  if (!row || row.count < MAX_FAILURES) {
    return 0;
  }
  const remaining = row.window_start + LOCKOUT_WINDOW_SECONDS - nowSeconds();
  return remaining > 0 ? remaining : 0;
};

export const recordFailure = async (c: Ctx, email: string): Promise<void> => {
  const now = nowSeconds();
  const windowFloor = now - LOCKOUT_WINDOW_SECONDS;
  await c.env.DB.batch([
    // a failure after the window has passed starts a new window
    c.env.DB.prepare(
      `INSERT INTO login_failures (email, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(email) DO UPDATE SET
         count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END`
    ).bind(email, now, windowFloor, windowFloor),
    // forget stale entries (emails that were tried and never came back)
    c.env.DB.prepare(`DELETE FROM login_failures WHERE window_start <= ? AND email != ?`).bind(windowFloor, email),
  ]);
};

export const clearFailures = async (c: Ctx, email: string): Promise<void> => {
  await c.env.DB.prepare(`DELETE FROM login_failures WHERE email = ?`).bind(email).run();
};

export const tooManyRequests = (c: Ctx, retryAfterSeconds: number, message: string) => {
  c.header("Retry-After", String(Math.max(1, Math.ceil(retryAfterSeconds))));
  return c.text(message, 429);
};
