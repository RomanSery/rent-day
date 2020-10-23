/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { NextFunction, Request, Response } from "express";
import { createTestGame } from "../TestGameSetup";
import { check, validationResult } from "express-validator";
import { GameInstance } from "../../core/schema/GameInstanceSchema";
import { GameContext } from "../../core/types/GameContext";
import { processRoll } from "./gameplay";

export const roll = async (req: Request, res: Response) => {
  res.json({ game: await processRoll(getGameContextFromUrl(req)) });
};

export const initTestGame = async (req: Request, res: Response) => {
  const testGame: GameContext = await createTestGame();
  res.json(testGame);
};

export const getGame = async (req: Request, res: Response) => {
  await check("gameId", "Please enter a valid gameId.").notEmpty().run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.json({ err: "missing gameId" });
  }

  const gameId = req.body.gameId;

  const found = await GameInstance.findById(gameId, (err, existingGame) => {
    if (err) {
      return console.log(err);
    }
    return existingGame;
  });

  res.json({ game: found });
};

const getGameContextFromUrl = (req: Request): GameContext => {
  const gid: any = req.body.context.gameId;
  const pid: any = req.body.context.playerId;

  return { gameId: gid, playerId: pid };
};
