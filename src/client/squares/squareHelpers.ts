import { NyThemeData } from "../../core/config/NyTheme";
import { GameState } from "../../core/types/GameState";
import { SquareGameData } from "../../core/types/SquareGameData";
import { SquareThemeData } from "../../core/types/SquareThemeData";
import { areObjectIdsEqual } from "../helpers";

export const getSquareTxt = (
  gameInfo: GameState | undefined,
  squareId: number
) => {
  if (gameInfo && gameInfo.theme) {
    return gameInfo.theme[squareId].name;
  }

  const data: SquareThemeData | undefined = NyThemeData.get(squareId);
  if (data != null) {
    return data.name;
  }

  return "";
};

export const getSquareStyle = (
  gameInfo: GameState | undefined,
  squareId: number
): React.CSSProperties => {
  const data = getSquareGameData(gameInfo, squareId);
  if (data && data.owner && data.color) {
    return { color: data.color, textDecoration: "underline" };
  }

  return {};
};

export const getOwnerPlayer = (
  gameInfo: GameState | undefined,
  squareId: number
) => {
  const data = getSquareGameData(gameInfo, squareId);
  if (data && gameInfo && data.owner && data.color) {
    const ownerPlayer = gameInfo.players.find((p) =>
      areObjectIdsEqual(p._id, data.owner)
    );
    if (ownerPlayer) {
      return ownerPlayer;
    }
  }
  return null;
};

export const isBeingAuctioned = (
  gameInfo: GameState | undefined,
  squareId: number
) => {
  return (
    gameInfo &&
    gameInfo.auctionId &&
    gameInfo.auctionSquareId &&
    gameInfo.auctionSquareId === squareId
  );
};

const getSquareGameData = (
  gameInfo: GameState | undefined,
  squareId: number
): SquareGameData | undefined => {
  if (squareId && gameInfo && gameInfo.squareState) {
    return gameInfo.squareState.find(
      (p: SquareGameData) => p.squareId === squareId
    );
  }
  return undefined;
};
