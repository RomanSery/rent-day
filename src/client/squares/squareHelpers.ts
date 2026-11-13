import { NyThemeData } from "../../core/config/NyTheme";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { GameState } from "../../core/types/GameState";
import { SquareGameData } from "../../core/types/SquareGameData";
import { SquareThemeData } from "../../core/types/SquareThemeData";
import { areObjectIdsEqual } from "../helpers";

/** names for squares the theme doesn't name */
const SQUARE_TYPE_NAMES: Partial<Record<SquareType, string>> = {
  [SquareType.Chance]: "Chance",
  [SquareType.Lotto]: "NY Lotto",
  [SquareType.CentralPark]: "Central Park",
  [SquareType.PayDay]: "Pay Day",
  [SquareType.Isolation]: "Quarantine",
  [SquareType.GoToIsolation]: "Big Brother",
};

/**
 * A square's display name. The game's theme only names properties, stations
 * and utilities; other squares (Chance, Lotto, the corners) fall back to a
 * name for their type, so callers can ask about any square without crashing.
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
  if (data?.name) {
    return data.name;
  }

  const type = SquareConfigDataMap.get(squareId)?.type;
  return (type && SQUARE_TYPE_NAMES[type]) || "";
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
