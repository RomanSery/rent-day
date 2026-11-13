import { NyThemeData } from "../../core/config/NyTheme";
import { GameState } from "../../core/types/GameState";
import { SquareGameData } from "../../core/types/SquareGameData";
import { SquareThemeData } from "../../core/types/SquareThemeData";
import { areObjectIdsEqual } from "../helpers";

/**
 * A square's display name. Every square is named in the theme, but games
 * created before Chance, Lotto and the corners were added to it store an older
 * copy without them, so those fall back to the built-in theme.
 */
export const getSquareTxt = (
  gameInfo: GameState | undefined,
  squareId: number
): string => {
  const themed = gameInfo?.theme?.[squareId]?.name;
  if (themed) {
    return themed;
  }

  const data: SquareThemeData | undefined = NyThemeData.get(squareId);
  return data?.name ?? "";
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
