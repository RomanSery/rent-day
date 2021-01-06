/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import mongoose from "mongoose";
import { Request, Response } from "express";
import { check, validationResult } from "express-validator";
import _ from "lodash";
import { getVerifiedUserId } from "./helpers";
import { GameProcessor } from "./GameProcessor";
import { JoinResult } from "../../core/types/JoinResult";
import { AuctionProcessor } from "./AuctionProcessor";
import { PieceType } from "../../core/enums/PieceType";
import { PlayerClass } from "../../core/enums/PlayerClass";

export const createGame = async (req: Request, res: Response) => {
  await check("data.gameName", "Name missing")
    .notEmpty()
    .isAlphanumeric()
    .run(req);
  await check("data.maxPlayers", "# of players missing")
    .notEmpty()
    .isNumeric()
    .run(req);
  await check("data.initialMoney", "InitialMoney is not valid")
    .notEmpty()
    .isNumeric()
    .run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).send(errors);
  }

  const userId = getVerifiedUserId(req.body.context);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const gameName = req.body.data.gameName;
  const maxPlayers = req.body.data.maxPlayers;
  const initialMoney = req.body.data.initialMoney;

  const process = new GameProcessor();
  const newGameId = await process.createGame(
    gameName,
    maxPlayers,
    initialMoney,
    userId
  );

  return res.json({ gameId: newGameId });
};

export const getGame = async (req: Request, res: Response) => {
  await check("gameId", "invalid gameId").notEmpty().run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send(errors);
  }

  if (getVerifiedUserId(req.body.context) == null) {
    return res.status(400).send("Invalid auth token");
  }

  const gameId = req.body.gameId;
  const process = new GameProcessor();
  res.json({ game: await process.getGame(gameId) });
};

export const getAuction = async (req: Request, res: Response) => {
  await check("auctionId", "Please enter a valid auctionId.")
    .notEmpty()
    .run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).send("missing auctionId");
  }

  const userId = getVerifiedUserId(req.body.context);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const auctionId = new mongoose.Types.ObjectId(req.body.auctionId);
  res.json({ auction: await AuctionProcessor.getAuction(auctionId, userId) });
};

export const getGamesToJoin = async (req: Request, res: Response) => {
  if (getVerifiedUserId(req.body.context) == null) {
    return res.status(400).send("Invalid auth token");
  }

  const process = new GameProcessor();
  res.json({ games: await process.getGamesToJoin() });
};

export const getGameStatus = async (req: Request, res: Response) => {
  await check("gameId", "Missing gameId.").notEmpty().run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).send("missing gameId");
  }

  const gameId = req.body.gameId;
  const process = new GameProcessor();
  res.json({ status: await process.getGameStatus(gameId) });
};

export const joinGame = async (req: Request, res: Response) => {
  await check("gameId", "GameId missing").notEmpty().run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send(errors);
  }

  const userId = getVerifiedUserId(req.body.context);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const gameId = req.body.gameId;
  const selectedPiece: PieceType = _.trim(req.body.piece) as PieceType;
  const selectedPlayerClass: PlayerClass = _.trim(
    req.body.playerClass
  ) as PlayerClass;

  const join = new GameProcessor();
  const errMsg = await join.getJoinGameErrMsg(gameId, userId, selectedPiece);
  if (errMsg) {
    return res.status(400).send(errMsg);
  }

  const result: JoinResult | null = await join.joinGame(
    gameId,
    userId,
    selectedPiece,
    selectedPlayerClass
  );
  if (result) {
    res.json(result);
  } else {
    return res.status(400).send("Error joining");
  }
};

export const leaveGame = async (req: Request, res: Response) => {
  await check("gameId", "GameId missing").notEmpty().run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send(errors);
  }

  const userId = getVerifiedUserId(req.body.context);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const gameId = req.body.gameId;

  const leave = new GameProcessor();
  await leave.leaveGame(gameId, userId);

  res.json({ status: "success" });
};
