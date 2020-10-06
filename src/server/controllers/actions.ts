/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { NextFunction, Request, Response } from "express";
import { createTestGame } from "../TestGameSetup";
import { check, sanitize, validationResult } from "express-validator";
import { GameInstance } from "../../core/schema/GameInstanceSchema";
import { GameContext } from "../../core/types/GameContext";

export const getLogin = (req: Request, res: Response) => {
  res.send("Hello World!");
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
