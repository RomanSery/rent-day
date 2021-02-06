import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { JWT_SECRET } from "../util/secrets";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
import { Player } from "../../core/types/Player";
import { SquareConfigData } from "../../core/types/SquareConfigData";
import { SquareGameData } from "../../core/types/SquareGameData";

export const dollarFormatterServer = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const getVerifiedUserId = (
  requestContext: any
): mongoose.Types.ObjectId | null => {
  const authToken = requestContext.authToken;

  try {
    const verified: any = jwt.verify(authToken, JWT_SECRET, {
      ignoreExpiration: true,
    });

    if (verified) {
      const verifiedUserId = verified.id;
      if (verifiedUserId) {
        return new mongoose.Types.ObjectId(verifiedUserId);
      }
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  return null;
};

export const areIdsEqual = (id1: string, id2: string): boolean => {
  if (id1 && id2) {
    const objectId1 = new mongoose.Types.ObjectId(id1);
    const objectId2 = new mongoose.Types.ObjectId(id2);
    return objectId1.equals(objectId2) ? true : false;
  }
  return false;
};

export const doesOwnAllPropertiesInGroup = (
  game: GameInstanceDocument,
  squareId: number,
  playerId: mongoose.Types.ObjectId
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
      if (!new mongoose.Types.ObjectId(squareData.owner).equals(playerId)) {
        ownsAll = false;
        return;
      }
    }
  });

  return ownsAll;
};

export const howManyTrainStationsDoesPlayerOwn = (
  game: GameInstanceDocument,
  player: Player
): number => {
  let numOwned = 0;
  const playerId = new mongoose.Types.ObjectId(player._id);

  SquareConfigDataMap.forEach((d: SquareConfigData, key: number) => {
    if (d.type === SquareType.TrainStation) {
      const squareData: SquareGameData | undefined = game.squareState.find(
        (p: SquareGameData) => p.squareId === key
      );

      if (
        squareData &&
        squareData.owner &&
        new mongoose.Types.ObjectId(squareData.owner).equals(playerId)
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
