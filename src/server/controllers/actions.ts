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
import { LottoProcessor } from "./LottoProcessor";
import { UserInstance } from "../../core/schema/UserSchema";
import { PlayerInfo } from "../../core/types/PlayerInfo";

export const createGame = async (req: Request, res: Response) => {
  await check("data.gameName", "Name missing")
    .notEmpty()
    .isAlpha("en-US", { ignore: " " })
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

  const userId = getVerifiedUserId(req);
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

  if (getVerifiedUserId(req) == null) {
    return res.status(400).send("Invalid auth token");
  }

  const gameId = req.body.gameId;
  res.json({ game: await GameProcessor.getGame(gameId) });
};

export const getAuction = async (req: Request, res: Response) => {
  await check("auctionId", "Please enter a valid auctionId.")
    .notEmpty()
    .run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).send("missing auctionId");
  }

  const userId = getVerifiedUserId(req);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const auctionId = new mongoose.Types.ObjectId(req.body.auctionId);
  res.json({ auction: await AuctionProcessor.getAuction(auctionId, userId) });
};

export const getGamesToJoin = async (req: Request, res: Response) => {
  if (getVerifiedUserId(req) == null) {
    return res.status(400).send("Invalid auth token");
  }

  const process = new GameProcessor();
  res.json({ games: await process.getGamesToJoin() });
};

export const getAllPlayers = async (req: Request, res: Response) => {
  if (getVerifiedUserId(req) == null) {
    return res.status(400).send("Invalid auth token");
  }

  const players: PlayerInfo[] = [];
  await UserInstance.find({}, function (err, users) {
    if (err) {
      return console.log(err);
    }

    for (let u of users) {
      players.push({
        name: u.username,
        wins: u.wins,
        gamesPlayed: u.gamesPlayed,
        currGame: u.currGameName,
      });
    }
  });

  res.json({ players: players });
};

export const getGameStatus = async (req: Request, res: Response) => {
  await check("gameId", "Missing gameId.").notEmpty().run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).send("missing gameId");
  }

  const userId = getVerifiedUserId(req);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const gameId = req.body.gameId;
  res.json({ status: await GameProcessor.getGameStatus(gameId, userId) });
};

export const joinGame = async (req: Request, res: Response) => {
  await check("gameId", "GameId missing").notEmpty().run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send(errors);
  }

  const userId = getVerifiedUserId(req);
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

  const userId = getVerifiedUserId(req);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const gameId = req.body.gameId;

  const leave = new GameProcessor();
  await leave.leaveGame(gameId, userId);

  res.json({ status: "success" });
};

export const getLotto = async (req: Request, res: Response) => {
  await check("lottoId", "Missing lottoId").notEmpty().run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).send("missing lottoId");
  }

  const userId = getVerifiedUserId(req);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const lottoId = new mongoose.Types.ObjectId(req.body.lottoId);
  res.json({ lotto: await LottoProcessor.getLotto(lottoId) });
};
