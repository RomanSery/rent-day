/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for the game WebSocket origin, e.g. ws://localhost:8787 */
  readonly VITE_WS_URL?: string;
  /** Cloudflare Turnstile site key for the sign-up form (public; the secret lives in the Worker) */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
