/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import mongoose from "mongoose";
import { NextFunction, Request, Response } from "express";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { DiceRoll } from "../../core/types/DiceRoll";
import { GameContext } from "../../core/types/GameContext";

export const roll = async (req: Request, res: Response) => {
  const context: GameContext = getGameContextFromUrl(req);
  const result = await processRoll(context);

  res.json({ game: result });
};

const processRoll = async (context: GameContext) => {
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
    (p) => p._id && p._id.toString() === playerId
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

const getGameContextFromUrl = (req: Request): GameContext => {
  const gid: any = req.body.context.gameId;
  const pid: any = req.body.context.playerId;

  return { gameId: gid, playerId: pid };
};
