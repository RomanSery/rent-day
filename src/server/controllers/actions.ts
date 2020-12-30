/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Request, Response } from "express";
import { check, validationResult } from "express-validator";
import _ from "lodash";
import { GameContext } from "../../core/types/GameContext";
import { getGameContextFromUrl } from "./helpers";
import { GameProcessor } from "./GameProcessor";
import { JoinResult } from "../../core/types/JoinResult";
import { AuctionProcessor } from "./AuctionProcessor";

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

  const gameName = req.body.data.gameName;
  const maxPlayers = req.body.data.maxPlayers;
  const initialMoney = req.body.data.initialMoney;

  const process = new GameProcessor();
  const newGameId = await process.createGame(
    gameName,
    maxPlayers,
    initialMoney
  );

  return res.json({ gameId: newGameId });
};

export const getGame = async (req: Request, res: Response) => {
  await check("gameId", "invalid gameId").notEmpty().run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send(errors);
  }

  const gameId = req.body.gameId;
  const process = new GameProcessor();
  res.json({ game: process.getGame(gameId) });
};

export const getAuction = async (req: Request, res: Response) => {
  await check("auctionId", "Please enter a valid auctionId.")
    .notEmpty()
    .run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).send("missing auctionId");
  }

  const context: GameContext = getGameContextFromUrl(req);
  const auctionId = req.body.auctionId;
  const auction = new AuctionProcessor(0, context);

  res.json({ auction: auction.getAuction(auctionId, context.playerId) });
};

export const getGamesToJoin = async (req: Request, res: Response) => {
  const process = new GameProcessor();
  res.json({ games: process.getGamesToJoin() });
};

export const getGameStatus = async (req: Request, res: Response) => {
  await check("gameId", "Please enter a valid gameId.").notEmpty().run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).send("missing gameId");
  }

  const gameId = req.body.gameId;
  const process = new GameProcessor();
  res.json({ status: process.getGameStatus(gameId) });
};

export const joinGame = async (req: Request, res: Response) => {
  await check("gameId", "GameId missing").notEmpty().run(req);
  await check("name", "Name is not valid")
    .notEmpty()
    .isLength({ min: 4 })
    .isAlphanumeric()
    .run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send(errors);
  }

  const gameId = req.body.gameId;
  const playerName = _.trim(req.body.name);
  const selectedPiece: number = parseInt(_.trim(req.body.piece));
  const selectedPlayerClass: number = parseInt(_.trim(req.body.playerClass));

  const join = new GameProcessor();
  const errMsg = await join.getJoinGameErrMsg(
    gameId,
    playerName,
    selectedPiece
  );
  if (errMsg) {
    return res.status(400).send(errMsg);
  }

  const result: JoinResult | null = await join.joinGame(
    gameId,
    playerName,
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
  await check("playerId", "playerId missing").notEmpty().run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send(errors);
  }

  const gameId = req.body.gameId;
  const playerId = req.body.playerId;

  const leave = new GameProcessor();
  leave.leaveGame(gameId, playerId);

  res.json({ status: "success" });
};
