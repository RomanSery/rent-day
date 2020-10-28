/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { DiceRoll } from "../../core/types/DiceRoll";
import { GameContext } from "../../core/types/GameContext";

export const processRoll = async (context: GameContext) => {
  const gameId: string = context.gameId;
  const playerId: string = context.playerId;

  let existingGame = await GameInstance.findById(gameId);

  if (existingGame == null) {
    return console.log("not found");
  }

  const playerObjId = new mongoose.Types.ObjectId(context.playerId);
  if (!playerObjId.equals(existingGame.nextPlayerToAct)) {
    return console.log("not your turn!");
  }

  const newRoll = new DiceRoll();

  const playerToAct = existingGame.players.find(
    (p) => p._id.toString() === playerId
  );
  if (playerToAct == null) {
    return console.log("player not found!");
  }

  console.log(playerToAct.name + "is rolling: " + newRoll.prettyPrint());

  const newPosition = playerToAct.position + newRoll.sum();
  playerToAct.position = newPosition;

  existingGame.save();

  return existingGame;
};
