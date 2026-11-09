import type { GameRoom } from "./game/GameRoom";

export interface Env {
  DB: D1Database;
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  ENVIRONMENT?: string;
  PBKDF2_ITERATIONS?: string;
  /** "true" to give the second player every property when a dev game starts */
  DEV_PREOWN_PROPERTIES?: string;
  /** development only: shorten the turn / auction timers (seconds) */
  DEV_TURN_SECONDS?: string;
  DEV_AUCTION_SECONDS?: string;
}

export const isDevEnv = (env: Env): boolean =>
  !env.ENVIRONMENT || env.ENVIRONMENT === "development";
