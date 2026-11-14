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
import { SocketService } from "./sockets/SocketService";
import { GameEvent } from "../core/types/GameEvent";

export const dollarFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/*
 * The game this tab is watching as a spectator (the /watch page), kept in
 * memory only: it is not the player's own game, so it must never replace
 * the stored GAME_ID that leaving, resigning and redirects rely on.
 */
let watchingGameId: string | null = null;

export const setWatchingGameId = (gameId: string | null): void => {
  watchingGameId = gameId;
};

/** True on the /watch page: the board is read-only and nothing is sent. */
export const isWatching = (): boolean => watchingGameId !== null;

export const getGameContextFromLocalStorage = (): GameContext => {
  const gid = watchingGameId ?? getMyGameId();

  return { gameId: gid };
};

export enum StorageConstants {
  GAME_ID = "myGameId",
  PLAYER_NAME = "myPlayerName",
  USER_ID = "myUserId",
  LOGGED_IN = "isLoggedIn",
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
  return sessionStorage.getItem(StorageConstants.GAME_ID) != null;
};

export const leaveCurrentGameIfJoined = async (
  socketService: SocketService | null,
  callback: () => void
) => {
  if (!hasJoinedGame()) {
    clearMyGameInfo();
    return callback();
  }

  const context: GameContext = getGameContextFromLocalStorage();
  const gameId = getMyGameId();

  await API.post("leaveGame", {
    gameId: gameId,
    userId: getMyUserId(),
    context,
  })
    .then(function (response) {
      if (socketService) {
        socketService.socket.emit(GameEvent.LEAVE_GAME, gameId);
      }
      clearMyGameInfo();
      return callback();
    })
    .catch(handleApiError);
};

export const resignCurrGame = async (
  socketService: SocketService | null,
  callback: () => void
) => {
  if (!hasJoinedGame()) {
    clearMyGameInfo();
    return callback();
  }

  const context: GameContext = getGameContextFromLocalStorage();
  const gameId = getMyGameId();

  await API.post("resignGame", {
    gameId: gameId,
    userId: getMyUserId(),
    context,
  })
    .then(function (response) {
      if (socketService) {
        socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameId);
      }
      clearMyGameInfo();
      return callback();
    })
    .catch(handleApiError);
};

export const setCurrSessionInfo = (data: any): void => {
  sessionStorage.setItem(StorageConstants.USER_ID, data.id);
  sessionStorage.setItem(StorageConstants.PLAYER_NAME, data.userName);
  localStorage.setItem(StorageConstants.LOGGED_IN, "1");

  const gameId: string = data.currGameId;
  if (gameId && gameId.length > 0) {
    sessionStorage.setItem(StorageConstants.GAME_ID, gameId);
  }
};

export const clearMyGameInfo = (): void => {
  sessionStorage.removeItem(StorageConstants.GAME_ID);
};

export const setJoinedGameStorage = (gameId: string): void => {
  sessionStorage.setItem(
    StorageConstants.GAME_ID,
    getObjectIdAsHexString(gameId)
  );
};

export const isLoggedIn = (): boolean => {
  return localStorage.getItem(StorageConstants.LOGGED_IN) != null;
};

export const logOut = (): void => {
  sessionStorage.clear();
  localStorage.clear();
};

/*
 * Where a signed-out visitor was going (an invite link to /join?gid=...), so
 * that signing up or logging in takes them there instead of to the lobby.
 * Kept in sessionStorage: it belongs to this tab and the visit.
 */
const RETURN_TO_KEY = "returnTo";
const AUTH_PAGES = ["/", "/auth", "/login", "/newuser", "/dashboard"];

const isSafeReturnPath = (path: string | null): path is string =>
  !!path && path.startsWith("/") && !path.startsWith("//") &&
  !AUTH_PAGES.includes(path.split("?")[0]);

export const rememberReturnTo = (path: string): void => {
  if (!isSafeReturnPath(path)) {
    return;
  }
  try {
    sessionStorage.setItem(RETURN_TO_KEY, path);
  } catch (e) {
    // storage blocked: they land in the lobby as before
  }
};

/** The remembered page without forgetting it (for the "you've been invited" note). */
export const peekReturnTo = (): string | null => {
  try {
    const path = sessionStorage.getItem(RETURN_TO_KEY);
    return isSafeReturnPath(path) ? path : null;
  } catch (e) {
    return null;
  }
};

/** Where to go after signing up or logging in: the remembered page, once, else the lobby. */
export const takeReturnTo = (): string => {
  const path = peekReturnTo();
  try {
    sessionStorage.removeItem(RETURN_TO_KEY);
  } catch (e) {
    // nothing to clear
  }
  return path ?? "/dashboard";
};

/** True when the visitor followed an invite link to a game. */
export const hasPendingInvite = (): boolean => (peekReturnTo() ?? "").startsWith("/join?");

export const tryToRedirectToGame = async (
  pageType: PageType,
  myGameId: string | null,
  callback: (redirectUrl: string) => void
) => {
  if (!isLoggedIn()) {
    return;
  }

  if (myGameId === null || myGameId === undefined) {
    return;
  }

  const gameStatus: GameStatus = await getGameStatus(myGameId);

  if (gameStatus == null) {
    clearMyGameInfo();
    return callback("/dashboard");
  }

  if (hasJoinedGame()) {
    if (pageType === PageType.Home || pageType === PageType.Find) {
      return callback(
        gameStatus === GameStatus.JOINING
          ? "/join?gid=" + myGameId
          : "/gameinstance"
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

// ids are plain 24-hex strings now; these helpers only normalise them
export const getObjectIdAsHexString = (id: string | any): string => {
  return String(id).toLowerCase();
};

export const areObjectIdsEqual = (
  id1: string | any,
  id2: string | any
): boolean => {
  if (id1 && id2) {
    return String(id1).toLowerCase() === String(id2).toLowerCase();
  }

  return false;
};

export const handleApiError = (error: any) => {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    if (error.response.data) {
      if (error.response.data.errors && error.response.data.errors.length > 0) {
        alert(error.response.data.errors[0].msg);
      } else {
        alert(error.response.data);
      }
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
