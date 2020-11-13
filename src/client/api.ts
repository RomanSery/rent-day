import axios from "axios";
import queryString from "query-string";
import { GameContext } from "../core/types/GameContext";

export default axios.create({
  baseURL: "/api/",
  timeout: 5000,
});

export const getGameContextFromUrl = (search: string): GameContext => {
  const parsed = queryString.parse(search);
  const gid: any = parsed.gid;
  const pid: any = parsed.pid;

  return { gameId: gid, playerId: pid };
};

export enum StorageConstants {
  GAME_ID = "myGameId",
  PLAYER_ID = "myPlayerId",
}

export const getMyGameId = (): string | null => {
  return localStorage.getItem(StorageConstants.GAME_ID);
};
export const getMyPlayerId = (): string | null => {
  return localStorage.getItem(StorageConstants.PLAYER_ID);
};

export const hasJoinedGame = (): boolean => {
  const myGameId = getMyGameId();
  const myPlayerId = getMyPlayerId();
  return myGameId != null && myPlayerId != null;
};

export const clearMyGameInfo = (): void => {
  localStorage.clear();
};

export const setJoinedGameStorage = (
  gameId: string,
  playerId: string
): void => {
  localStorage.setItem(StorageConstants.GAME_ID, gameId);
  localStorage.setItem(StorageConstants.PLAYER_ID, playerId);
};
