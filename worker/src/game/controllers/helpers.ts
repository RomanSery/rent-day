import { SquareConfigDataMap } from "@core/config/SquareData";
import { SquareType } from "@core/enums/SquareType";
import { Player } from "@core/types/Player";
import { SquareConfigData } from "@core/types/SquareConfigData";
import { SquareGameData } from "@core/types/SquareGameData";
import { GameInstanceDocument } from "../model";
import { areIdsEqual } from "../ids";

export { areIdsEqual };

export const dollarFormatterServer = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const doesOwnAllPropertiesInGroup = (
  game: GameInstanceDocument,
  squareId: number,
  playerId: string
): boolean => {
  const squareConfig = SquareConfigDataMap.get(squareId);
  if (!squareConfig || !squareConfig.groupId) {
    return false;
  }

  const groupId = squareConfig.groupId;
  let ownsAll = true;
  SquareConfigDataMap.forEach((d: SquareConfigData, key: number) => {
    if (d.groupId && d.groupId === groupId) {
      const squareData: SquareGameData | undefined = game.squareState.find(
        (p: SquareGameData) => p.squareId === key
      );

      if (!squareData || !squareData.owner) {
        ownsAll = false;
        return;
      }
      if (!areIdsEqual(squareData.owner, playerId)) {
        ownsAll = false;
        return;
      }
    }
  });

  return ownsAll;
};

export const canTravel = (
  game: GameInstanceDocument,
  player: Player
): boolean => {
  let numOwned = 0;

  SquareConfigDataMap.forEach((d: SquareConfigData, key: number) => {
    if (d.type === SquareType.TrainStation) {
      const squareData: SquareGameData | undefined = game.squareState.find(
        (p: SquareGameData) => p.squareId === key
      );

      if (
        squareData &&
        squareData.owner &&
        !squareData.isMortgaged &&
        areIdsEqual(squareData.owner, player._id)
      ) {
        numOwned++;
      }
    }
  });

  if (numOwned <= 1) {
    return false;
  }

  const posConfig = SquareConfigDataMap.get(player.position);
  if (!posConfig || posConfig.type !== SquareType.TrainStation) {
    return false;
  }

  const posData: SquareGameData | undefined = game.squareState.find(
    (p: SquareGameData) => p.squareId === player.position
  );
  if (
    !posData ||
    !posData.owner ||
    !areIdsEqual(posData.owner, player._id) ||
    posData.isMortgaged
  ) {
    return false;
  }

  return true;
};

export const howManyTrainStationsDoesPlayerOwn = (
  game: GameInstanceDocument,
  player: Player
): number => {
  let numOwned = 0;

  SquareConfigDataMap.forEach((d: SquareConfigData, key: number) => {
    if (d.type === SquareType.TrainStation) {
      const squareData: SquareGameData | undefined = game.squareState.find(
        (p: SquareGameData) => p.squareId === key
      );

      if (
        squareData &&
        squareData.owner &&
        areIdsEqual(squareData.owner, player._id)
      ) {
        numOwned++;
      }
    }
  });

  return numOwned;
};

export const doesPropertyHaveHouses = (
  game: GameInstanceDocument,
  squareId: number
): boolean => {
  const squareData: SquareGameData | undefined = game.squareState.find(
    (p: SquareGameData) => p.squareId === squareId
  );

  return squareData && squareData.numHouses > 0 ? true : false;
};

export const doesGroupHaveAnyHouses = (
  game: GameInstanceDocument,
  groupId: number
): boolean => {
  let hasHouses = false;
  SquareConfigDataMap.forEach((d: SquareConfigData, key: number) => {
    if (d.groupId && d.groupId === groupId) {
      const squareData: SquareGameData | undefined = game.squareState.find(
        (p: SquareGameData) => p.squareId === key
      );

      if (squareData && squareData.numHouses > 0) {
        hasHouses = true;
        return;
      }
    }
  });

  return hasHouses;
};

export const doesGroupHaveMortgagedProperty = (
  game: GameInstanceDocument,
  groupId: number
): boolean => {
  let hasMortgaged = false;
  SquareConfigDataMap.forEach((d: SquareConfigData, key: number) => {
    if (d.groupId && d.groupId === groupId) {
      const squareData: SquareGameData | undefined = game.squareState.find(
        (p: SquareGameData) => p.squareId === key
      );
      if (squareData && squareData.isMortgaged) {
        hasMortgaged = true;
      }
    }
  });
  return hasMortgaged;
};

export const areHousesEven = (
  game: GameInstanceDocument,
  squareId: number,
  building: boolean
): boolean => {
  const squareConfig = SquareConfigDataMap.get(squareId);
  if (!squareConfig || !squareConfig.groupId) {
    return false;
  }

  const groupId = squareConfig.groupId;
  let numHousesOnTargetSquare = 0;
  const numHousesMap: Map<number, number> = new Map();

  SquareConfigDataMap.forEach((d: SquareConfigData, key: number) => {
    if (d.groupId && d.groupId === groupId) {
      const squareData: SquareGameData | undefined = game.squareState.find(
        (p: SquareGameData) => p.squareId === key
      );

      if (squareData && squareData.owner) {
        numHousesMap.set(key, squareData.numHouses);
        if (key === squareId) {
          numHousesOnTargetSquare = squareData.numHouses;
        }
      }
    }
  });

  return (
    Array.from(numHousesMap.values()).filter((numHouses) =>
      building
        ? numHousesOnTargetSquare > numHouses
        : numHousesOnTargetSquare < numHouses
    ).length === 0
  );
};
