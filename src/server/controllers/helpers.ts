import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
import { Player } from "../../core/types/Player";
import { SquareConfigData } from "../../core/types/SquareConfigData";
import { SquareGameData } from "../../core/types/SquareGameData";

export const getVerifiedUserId = (
  requestContext: any
): mongoose.Types.ObjectId | null => {
  const authToken = requestContext.authToken;
  const userId = requestContext.userId;
  const uid = new mongoose.Types.ObjectId(userId);

  try {
    const verified: any = jwt.verify(authToken, "jwt-secret", {
      ignoreExpiration: true,
    });

    if (verified) {
      const verifiedUserId = verified.id;
      if (verifiedUserId) {
        const verifiedUid = new mongoose.Types.ObjectId(verifiedUserId);
        if (verifiedUid.equals(uid)) {
          return uid;
        }
      }
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  return null;
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
