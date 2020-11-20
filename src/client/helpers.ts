import { NextFunction } from "express";
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

export const tryToRedirectFromHomePage = async (
  callback: (redirectUrl: string) => void
) => {
  if (!hasJoinedGame()) {
    return;
  }

  const gameStatus: GameStatus = await getGameStatus(getMyGameId()!);
  if (gameStatus == null) {
    clearMyGameInfo();
    return callback("/");
  }

  if (gameStatus == GameStatus.JOINING) {
    return callback("/join?gid=" + getMyGameId() + "&pid=" + getMyPlayerId());
  } else if (gameStatus == GameStatus.ACTIVE) {
    return callback(
      "/gameinstance?gid=" + getMyGameId() + "&pid=" + getMyPlayerId()
    );
  }
};

export const tryToRedirectFromJoinPage = async (
  context: GameContext,
  callback: (redirectUrl: string) => void
) => {
  if (!hasJoinedGame()) {
    return;
  }

  const currGameId = context.gameId;
  const currPlayerId = context.playerId;
  const myGameId = getMyGameId();
  const myPlayerId = getMyPlayerId();
  const gameStatus: GameStatus = await getGameStatus(currGameId);

  if (currGameId === null) {
    return callback("/");
  }

  if (currGameId !== myGameId || context.playerId !== myPlayerId) {
    if (gameStatus == GameStatus.JOINING) {
      return callback("/join?gid=" + myGameId + "&pid=" + myPlayerId);
    } else if (gameStatus == GameStatus.ACTIVE) {
      return callback("/gameinstance?gid=" + myGameId + "&pid=" + myPlayerId);
    }
  }
};

const getGameStatus = async (gameId: string) => {
  const status = await API.post("getGameStatus", {
    gameId: gameId,
  })
    .then(function (response) {
      return response.data.status;
    })
    .catch(function (error) {
      console.log(error);
    });

  return status;
};
