import { GameStatus } from "../core/enums/GameStatus";
import { PageType } from "../core/enums/PageType";
import { GameContext } from "../core/types/GameContext";
import API from "./api";

export const getGameContextFromLocalStorage = (): GameContext => {
  const gid: any = getMyGameId();
  const pid: any = getMyPlayerId();

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

export const tryToRedirectToGame = async (
  pageType: PageType,
  callback: (redirectUrl: string) => void
) => {
  const myGameId = getMyGameId();
  if (myGameId === null) {
    return;
  }

  const gameStatus: GameStatus = await getGameStatus(myGameId);
  if (gameStatus == null) {
    clearMyGameInfo();
    return callback("/");
  }

  if (hasJoinedGame()) {
    if (pageType == PageType.Home || pageType == PageType.Find) {
      return callback(
        gameStatus == GameStatus.JOINING ? "/join" : "/gameinstance"
      );
    } else if (pageType == PageType.Join && gameStatus == GameStatus.ACTIVE) {
      return callback("/gameinstance");
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
