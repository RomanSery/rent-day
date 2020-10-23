/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import mongoose from "mongoose";
import { GameInstance } from "../../core/schema/GameInstanceSchema";
import { DiceRoll } from "../../core/types/DiceRoll";
import { GameContext } from "../../core/types/GameContext";

export const processRoll = async (context: GameContext) => {
  const gameId = context.gameId;
  const playerId = context.playerId;

  const found = await GameInstance.findById(gameId, (err, existingGame) => {
    if (err || existingGame == null) {
      return console.log(err);
    }

    console.log(existingGame.nextPlayerToAct);
    console.log(playerId + " is trying to roll");

    const playerObjId = new mongoose.Types.ObjectId(context.playerId);
    if (!playerObjId.equals(existingGame.nextPlayerToAct)) {
      return console.log("not your turn!");
    }

    const newRoll = new DiceRoll();

    const playerToAct = existingGame.players.find((p) => p.id === playerId);
    if (playerToAct == null) {
      return console.log("player not found!");
    }

    console.log(playerToAct.name + "is rolling");

    const newPosition = playerToAct.position + newRoll.sum();
    playerToAct.position = newPosition;

    existingGame.save();
  });

  return found;
};
