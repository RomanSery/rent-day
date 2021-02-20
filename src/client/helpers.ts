import mongoose from "mongoose";
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

export const dollarFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const getGameContextFromLocalStorage = (): GameContext => {
  const gid = getMyGameId();

  return { gameId: gid };
};

export enum StorageConstants {
  GAME_ID = "myGameId",
  JOINED_GAME = "hasJoinedGame",
  PLAYER_NAME = "myPlayerName",
  USER_ID = "myUserId",
}

export const getMyGameId = (): string | null => {
  const gameId = sessionStorage.getItem(StorageConstants.GAME_ID);
  if (gameId) {
    return gameId;
  }
  return null;
};
export const getMyPlayerName = (): string | null => {
  return sessionStorage.getItem(StorageConstants.PLAYER_NAME);
};

export const getMyUserId = (): string | null => {
  const userId = sessionStorage.getItem(StorageConstants.USER_ID);
  if (userId) {
    return userId;
  }
  return null;
};

export const hasJoinedGame = (): boolean => {
  const myGameId = getMyGameId();
  return (
    myGameId != null &&
    sessionStorage.getItem(StorageConstants.JOINED_GAME) != null
  );
};

export const leaveCurrentGameIfJoined = async (callback: () => void) => {
  if (!hasJoinedGame()) {
    clearMyGameInfo();
    return callback();
  }

  const context: GameContext = getGameContextFromLocalStorage();

  await API.post("leaveGame", {
    gameId: getMyGameId(),
    userId: getMyUserId(),
    context,
  })
    .then(function (response) {
      clearMyGameInfo();
      return callback();
    })
    .catch(handleApiError);
};

export const setCurrSessionInfo = (data: any): void => {
  sessionStorage.setItem(StorageConstants.USER_ID, data.id);
  sessionStorage.setItem(StorageConstants.PLAYER_NAME, data.userName);

  const gameId: string = data.currGameId;
  if (gameId && gameId.length > 0) {
    sessionStorage.setItem(StorageConstants.GAME_ID, gameId);
    sessionStorage.setItem(StorageConstants.JOINED_GAME, "true");
  }
};

export const clearMyGameInfo = (): void => {
  sessionStorage.removeItem(StorageConstants.GAME_ID);
  sessionStorage.removeItem(StorageConstants.JOINED_GAME);
};

export const setJoinedGameStorage = (gameId: string): void => {
  sessionStorage.setItem(
    StorageConstants.GAME_ID,
    getObjectIdAsHexString(gameId)
  );
  sessionStorage.setItem(StorageConstants.JOINED_GAME, "true");
};

export const isLoggedIn = (): boolean => {
  return sessionStorage.getItem(StorageConstants.USER_ID) != null;
};

export const logOut = (): void => {
  sessionStorage.clear();
  localStorage.clear();
};

export const tryToRedirectToGame = async (
  pageType: PageType,
  callback: (redirectUrl: string) => void
) => {
  if (!isLoggedIn()) {
    return;
  }

  const myGameId = getMyGameId();
  if (myGameId === null || myGameId === undefined) {
    return;
  }

  const gameStatus: GameStatus = await getGameStatus(myGameId);
  console.log(gameStatus);

  if (gameStatus == null) {
    clearMyGameInfo();
    return callback("/dashboard");
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

export const redirectToHomeIfGameNotFound = async (
  callback: (redirectUrl: string) => void
) => {
  if (!isLoggedIn()) {
    clearMyGameInfo();
    return callback("/auth");
  }

  const myGameId = getMyGameId();
  if (myGameId === null || myGameId === undefined) {
    clearMyGameInfo();
    return callback("/dashboard");
  }

  const gameStatus: GameStatus = await getGameStatus(myGameId);
  if (gameStatus == null) {
    clearMyGameInfo();
    return callback("/dashboard");
  }

  return;
};

const getGameStatus = async (gameId: string) => {
  const status = await API.post("getGameStatus", {
    gameId: gameId,
  })
    .then(function (response) {
      return response.data.status;
    })
    .catch(handleApiError);

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

export const getObjectIdAsHexString = (id: string | any): string => {
  if (typeof id === "string") {
    return new mongoose.Types.ObjectId(id).toHexString();
  }

  return (id as mongoose.Types.ObjectId).toHexString();
};

export const areObjectIdsEqual = (
  id1: string | any,
  id2: string | any
): boolean => {
  if (id1 && id2) {
    const objectId1 = new mongoose.Types.ObjectId(id1);
    const objectId2 = new mongoose.Types.ObjectId(id2);
    return objectId1.equals(objectId2);
  }

  return false;
};

export const handleApiError = (error: any) => {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    if (error.response.data) {
      alert(error.response.data);
    }
  } else if (error.request) {
    // The request was made but no response was received
    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    console.log(error.request);
  } else {
    // Something happened in setting up the request that triggered an Error
    console.log("Error", error.message);
  }
};
