/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import mongoose from "mongoose";
import { Request, Response } from "express";
import { check } from "express-validator";
import { getVerifiedUserId } from "./helpers";
import { AuctionProcessor } from "./AuctionProcessor";
import { RollProcessor } from "./RollProcessor";
import { LottoProcessor } from "./LottoProcessor";
import { PropertyProcessor } from "./PropertyProcessor";

export const roll = async (req: Request, res: Response) => {
  const userId = getVerifiedUserId(req.body.context);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }
  const gameId = new mongoose.Types.ObjectId(req.body.context.gameId);

  const processor = new RollProcessor(
    gameId,
    userId,
    req.body.forceDie1,
    req.body.forceDie2
  );
  await processor.init();

  const errMsg = await processor.getErrMsg();
  if (errMsg) {
    return res.status(400).send(errMsg);
  }

  await processor.roll();

  res.json({
    status: "success",
  });
};

export const completeTurn = async (req: Request, res: Response) => {
  const userId = getVerifiedUserId(req.body.context);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const gameId = new mongoose.Types.ObjectId(req.body.context.gameId);
  const processor = new RollProcessor(gameId, userId, null, null);
  await processor.init();
  await processor.completeMyTurn();

  res.json({
    status: "success",
  });
};

export const bid = async (req: Request, res: Response) => {
  await check("bid", "Bid is not valid").notEmpty().isNumeric().run(req);

  const userId = getVerifiedUserId(req.body.context);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const gameId = new mongoose.Types.ObjectId(req.body.context.gameId);
  const bidAmount = parseInt(req.body.bid);
  const processor = new AuctionProcessor(bidAmount, gameId, userId);
  await processor.init();

  const errMsg = await processor.getErrMsg();
  if (errMsg) {
    return res.status(400).send(errMsg);
  }

  await processor.placeBid();

  res.json({
    status: "success",
  });
};

export const pickLotto = async (req: Request, res: Response) => {
  await check("opt", "Opt is not valid").notEmpty().isNumeric().run(req);

  const userId = getVerifiedUserId(req.body.context);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const optNum = parseInt(req.body.opt);
  const gameId = new mongoose.Types.ObjectId(req.body.context.gameId);
  const processor = new LottoProcessor(optNum, gameId, userId);
  await processor.init();

  const errMsg = await processor.getErrMsg();
  if (errMsg) {
    return res.status(400).send(errMsg);
  }

  await processor.pickOption();

  res.json({
    status: "success",
  });
};

export const mortage = async (req: Request, res: Response) => {
  const userId = getVerifiedUserId(req.body.context);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const gameId = new mongoose.Types.ObjectId(req.body.context.gameId);
  const squareId = parseInt(req.body.squareId);
  const processor = new PropertyProcessor(squareId, gameId, userId);
  const errMsg = await processor.mortgageProperty();

  if (errMsg && errMsg.length > 0) {
    return res.status(400).send(errMsg);
  }

  res.json({
    status: "success",
  });
};

export const redeem = async (req: Request, res: Response) => {
  const userId = getVerifiedUserId(req.body.context);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const gameId = new mongoose.Types.ObjectId(req.body.context.gameId);
  const squareId = parseInt(req.body.squareId);
  const processor = new PropertyProcessor(squareId, gameId, userId);
  const errMsg = await processor.redeemProperty();

  if (errMsg && errMsg.length > 0) {
    return res.status(400).send(errMsg);
  }

  res.json({
    status: "success",
  });
};

export const getOut = async (req: Request, res: Response) => {
  const userId = getVerifiedUserId(req.body.context);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }
  const gameId = new mongoose.Types.ObjectId(req.body.context.gameId);

  const processor = new RollProcessor(gameId, userId, null, null);
  const errMsg = await processor.payToGetOut();
  if (errMsg && errMsg.length > 0) {
    return res.status(400).send(errMsg);
  }

  res.json({
    status: "success",
  });
};
