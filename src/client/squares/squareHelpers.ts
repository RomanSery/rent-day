import { GameState } from "../../core/types/GameState";
import { SquareGameData } from "../../core/types/SquareGameData";

export const getSquareTxt = (
  gameInfo: GameState | undefined,
  squareId: number
) => {
  if (gameInfo && gameInfo.theme) {
    return gameInfo.theme[squareId].name;
  }
  return "";
};

export const getSquareStyle = (
  gameInfo: GameState | undefined,
  squareId: number
): React.CSSProperties => {
  if (gameInfo && gameInfo.squareState && gameInfo.squareState[squareId]) {
    const data: SquareGameData = gameInfo.squareState[squareId];
    if (data && data.owner && data.color) {
      return { color: data.color, textDecoration: "underline" };
    }
  }

  return {};
};

export const getOwnerPlayer = (
  gameInfo: GameState | undefined,
  squareId: number
) => {
  if (gameInfo && gameInfo.squareState && gameInfo.squareState[squareId]) {
    const data: SquareGameData = gameInfo.squareState[squareId];
    if (data && data.owner && data.color) {
      const ownerPlayer = gameInfo.players.find(
        (p) => p._id && p._id.equals(data.owner)
      );
      if (ownerPlayer) {
        return ownerPlayer;
      }
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
