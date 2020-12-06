/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import mongoose from "mongoose";
import { Request, Response } from "express";
import { GameInstance } from "../../core/schema/GameInstanceSchema";
import { DiceRoll } from "../../core/types/DiceRoll";
import { GameContext } from "../../core/types/GameContext";
import { Player } from "../../core/types/Player";

export const roll = async (req: Request, res: Response) => {
  const context: GameContext = getGameContextFromUrl(req);

  const gameId: string = context.gameId;
  const playerId: string = context.playerId;

  let existingGame = await GameInstance.findById(gameId);

  if (existingGame == null) {
    return res.status(400).send("game not found");
  }

  const playerObjId = new mongoose.Types.ObjectId(context.playerId);
  if (!playerObjId.equals(existingGame.nextPlayerToAct)) {
    console.log("not your turn!");
    return res.status(400).send("not your turn!");
  }

  const newRoll = new DiceRoll();

  const playerToAct = existingGame.players.find(
    (p) => p._id && p._id.toString() === playerId
  );
  if (playerToAct == null) {
    console.log("player not found!");
    return res.status(400).send("player not found!");
  }

  console.log(playerToAct.name + " is rolling: " + newRoll.prettyPrint());

  let newPosition = playerToAct.position + newRoll.sum();
  if (newPosition >= 39) {
    newPosition = newPosition - 39;
    playerPassedGo(playerToAct);
  }
  playerToAct.position = newPosition;

  //set next player to act
  const index = existingGame.players.indexOf(playerToAct);
  const nextPlayer =
    index < existingGame.players.length - 1
      ? existingGame.players[index + 1]
      : existingGame.players[0];
  existingGame.nextPlayerToAct = new mongoose.Types.ObjectId(nextPlayer._id);
  console.log("next player to act: %s", nextPlayer.name);

  existingGame.save();

  res.json({
    status: "success",
  });
};

const playerPassedGo = (player: Player) => {
  player.money = player.money + 200;
};

const getGameContextFromUrl = (req: Request): GameContext => {
  const gid: any = req.body.context.gameId;
  const pid: any = req.body.context.playerId;

  return { gameId: gid, playerId: pid };
};
