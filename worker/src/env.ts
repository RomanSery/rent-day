import type { GameRoom } from "./game/GameRoom";

export interface Env {
  DB: D1Database;
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  ASSETS: Fetcher;
  /** per-IP limits on the login and sign-up endpoints (wrangler.jsonc "ratelimits") */
  LOGIN_LIMITER?: RateLimit;
  SIGNUP_LIMITER?: RateLimit;
  CONTACT_LIMITER?: RateLimit;
  /**
   * Comma-separated emails of the accounts that may read Contact Us messages
   * (/admin/messages). Set it as a secret, `wrangler secret put ADMIN_EMAILS`,
   * so the addresses stay out of the repository; locally, in .dev.vars.
   */
  ADMIN_EMAILS?: string;
  /**
   * Cloudflare Turnstile secret key for the sign-up form's bot check. Set it
   * as a secret, `wrangler secret put TURNSTILE_SECRET_KEY`; locally, in
   * .dev.vars (Turnstile's test secret works there). Without it sign-up is
   * refused.
   */
  TURNSTILE_SECRET_KEY?: string;
  /**
   * Comma-separated hostnames the sign-up page is served from. Siteverify
   * reports where the widget was solved, and tokens from anywhere else are
   * refused. Required in production; optional in development.
   */
  TURNSTILE_HOSTNAMES?: string;
  ENVIRONMENT?: string;
  PBKDF2_ITERATIONS?: string;
  /** development only: "true" turns the per-IP rate limits on (they are off in development) */
  DEV_RATE_LIMIT?: string;
  /** "true" to give the second player every property when a dev game starts */
  DEV_PREOWN_PROPERTIES?: string;
  /** development only: shorten the turn / auction timers (seconds) */
  DEV_TURN_SECONDS?: string;
  DEV_AUCTION_SECONDS?: string;
  /** development only: base delay between computer player actions (ms) */
  DEV_BOT_PACE_MS?: string;
  /** development only: delete finished games after this many seconds */
  DEV_PURGE_SECONDS?: string;
  /** development only: delete lobbies that haven't filled after this many seconds (default 24h) */
  DEV_LOBBY_SECONDS?: string;
  /** development only: how often a game records its latest move in the lobby index (default 5 min) */
  DEV_ACTIVITY_TOUCH_SECONDS?: string;
  /** development only: games without a move for this long leave the watch list (default 30 min) */
  DEV_WATCH_IDLE_SECONDS?: string;
}

/**
 * Development shortcuts (forced dice, /api/dev/*, non-Secure cookies) are
 * opt-in: only an explicit ENVIRONMENT=development turns them on, so a
 * deploy that loses its vars fails safe as production.
 */
export const isDevEnv = (env: Env): boolean => env.ENVIRONMENT === "development";
