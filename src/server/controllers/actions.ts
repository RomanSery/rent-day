/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { NextFunction, Request, Response } from "express";
import { createTestGame } from "../TestGameSetup";

export const getLogin = (req: Request, res: Response) => {
  res.send("Hello World!");
};

export const initTestGame = async (req: Request, res: Response) => {
  const newGameId = await createTestGame();
  //console.log("new game created: " + newGameId);
  res.json({ gameId: newGameId });
};
