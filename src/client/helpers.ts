import queryString from "query-string";
import { GameStatus } from "../core/enums/GameStatus";
import { GameContext } from "../core/types/GameContext";
import API from "./api";

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

export const tryToRedirectToExistingGame = (
  context: GameContext,
  onJoinScreen: boolean
): string | null => {
  const joinedGame = hasJoinedGame();
  let gameStatus: GameStatus = GameStatus.JOINING;
  console.log("here");

  API.post("getGame", { gameId: context.gameId })
    .then(function (response) {
      gameStatus = response.data.game.status;
      console.log(gameStatus);

      if (joinedGame) {
        if (gameStatus == GameStatus.JOINING) {
          return "/join?gid=" + getMyGameId() + "&pid=" + getMyPlayerId();
        } else if (gameStatus == GameStatus.ACTIVE) {
          return (
            "/gameinstance?gid=" + getMyGameId() + "&pid=" + getMyPlayerId()
          );
        }
      }

      if (joinedGame) {
        const myGameId = getMyGameId();
        const myPlayerId = getMyPlayerId();
        if (context.gameId !== myGameId || context.playerId !== myPlayerId) {
          return "/join?gid=" + myGameId + "&pid=" + myPlayerId;
        }
      }
    })
    .catch(function (error) {
      console.log(error);
    });

  console.log("return null");
  return null;
};
