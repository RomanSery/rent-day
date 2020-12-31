import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBicycle,
  faCar,
  faHatWizard,
  faChessPawn,
  faCat,
  faDog,
} from "@fortawesome/free-solid-svg-icons";
import { GameStatus } from "../core/enums/GameStatus";
import { PageType } from "../core/enums/PageType";
import { PieceType } from "../core/enums/PieceType";
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
  PLAYER_NAME = "myPlayerName",
}

export const getMyGameId = (): string | null => {
  return localStorage.getItem(StorageConstants.GAME_ID);
};
export const getMyPlayerId = (): string | null => {
  return localStorage.getItem(StorageConstants.PLAYER_ID);
};
export const getMyPlayerName = (): string | null => {
  return localStorage.getItem(StorageConstants.PLAYER_NAME);
};

export const hasJoinedGame = (): boolean => {
  const myGameId = getMyGameId();
  const myPlayerId = getMyPlayerId();
  return myGameId != null && myPlayerId != null;
};

export const leaveCurrentGameIfJoined = async (callback: () => void) => {
  if (!hasJoinedGame()) {
    clearMyGameInfo();
    return callback();
  }

  await API.post("leaveGame", {
    gameId: getMyGameId(),
    playerId: getMyPlayerId(),
  }).then(function (response) {
    clearMyGameInfo();
    return callback();
  });
};

export const clearMyGameInfo = (): void => {
  localStorage.clear();
};

export const setJoinedGameStorage = (
  gameId: string,
  playerId: string,
  playerName: string
): void => {
  localStorage.setItem(StorageConstants.GAME_ID, gameId);
  localStorage.setItem(StorageConstants.PLAYER_ID, playerId);
  localStorage.setItem(StorageConstants.PLAYER_NAME, playerName);
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
    if (pageType === PageType.Home || pageType === PageType.Find) {
      return callback(
        gameStatus === GameStatus.JOINING ? "/join" : "/gameinstance"
      );
    } else if (pageType === PageType.Join && gameStatus === GameStatus.ACTIVE) {
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

export const getIconProp = (type: PieceType): IconDefinition => {
  if (type === PieceType.Bicycle) {
    return faBicycle;
  } else if (type === PieceType.Car) {
    return faCar;
  } else if (type === PieceType.Hat) {
    return faHatWizard;
  } else if (type === PieceType.Pawn) {
    return faChessPawn;
  } else if (type === PieceType.Cat) {
    return faCat;
  } else if (type === PieceType.Dog) {
    return faDog;
  }
  return faChessPawn;
};
