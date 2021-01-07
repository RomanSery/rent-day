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
import jwt from "jsonwebtoken";

export const getGameContextFromLocalStorage = (): GameContext => {
  const gid = getMyGameId();
  const pid = getMyUserId();
  const token: any = getMyAuthToken();

  return { gameId: gid, userId: pid, authToken: token };
};

export enum StorageConstants {
  GAME_ID = "myGameId",
  JOINED_GAME = "hasJoinedGame",
  PLAYER_NAME = "myPlayerName",
  JWT_TOKEN = "jwtAuthToken",
}

export const getMyAuthToken = (): string | null => {
  return localStorage.getItem(StorageConstants.JWT_TOKEN);
};
export const getMyGameId = (): mongoose.Types.ObjectId | null => {
  const gameId = localStorage.getItem(StorageConstants.GAME_ID);
  if (gameId) {
    return new mongoose.Types.ObjectId(gameId);
  }
  return null;
};
export const getMyPlayerName = (): string | null => {
  return localStorage.getItem(StorageConstants.PLAYER_NAME);
};

export const getMyUserId = (): mongoose.Types.ObjectId | null => {
  if (!isLoggedIn()) {
    return null;
  }
  const decoded = jwt.decode(getMyAuthToken()!, { json: true });
  if (decoded) {
    return decoded["id"];
  }
  return null;
};

export const hasJoinedGame = (): boolean => {
  const myGameId = getMyGameId();
  return (
    myGameId != null &&
    localStorage.getItem(StorageConstants.JOINED_GAME) != null
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
  }).then(function (response) {
    clearMyGameInfo();
    return callback();
  });
};

export const clearMyGameInfo = (): void => {
  localStorage.removeItem(StorageConstants.GAME_ID);
  localStorage.removeItem(StorageConstants.JOINED_GAME);
};

export const setJoinedGameStorage = (gameId: mongoose.Types.ObjectId): void => {
  localStorage.setItem(
    StorageConstants.GAME_ID,
    getObjectIdAsHexString(gameId)
  );
  localStorage.setItem(StorageConstants.JOINED_GAME, "true");
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem(StorageConstants.JWT_TOKEN, token);
};

export const setPlayerName = (username: string): void => {
  localStorage.setItem(StorageConstants.PLAYER_NAME, username);
};

export const isLoggedIn = (): boolean => {
  return localStorage.getItem(StorageConstants.JWT_TOKEN) != null;
};

export const logOut = (): void => {
  localStorage.removeItem(StorageConstants.JWT_TOKEN);
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

const getGameStatus = async (gameId: mongoose.Types.ObjectId) => {
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

export const getObjectIdAsHexString = (
  id: mongoose.Types.ObjectId | any
): string => {
  if (typeof id === "string") {
    return new mongoose.Types.ObjectId(id).toHexString();
  }

  return (id as mongoose.Types.ObjectId).toHexString();
};
