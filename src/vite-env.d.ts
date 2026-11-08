/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for the game WebSocket origin, e.g. ws://localhost:8787 */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
