/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Request, Response } from "express";
import { check } from "express-validator";
import { getVerifiedUserId } from "./helpers";
import { AuctionProcessor } from "./AuctionProcessor";
import { RollProcessor } from "./RollProcessor";

export const roll = async (req: Request, res: Response) => {
  const userId = getVerifiedUserId(req.body.context);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }
  const gameId: string = req.body.context.gameId;

  const rollProcess = new RollProcessor(gameId, userId);
  await rollProcess.init();

  const errMsg = await rollProcess.getErrMsg();
  if (errMsg) {
    return res.status(400).send(errMsg);
  }

  await rollProcess.roll();

  res.json({
    status: "success",
  });
};

export const completeTurn = async (req: Request, res: Response) => {
  const userId = getVerifiedUserId(req.body.context);
  if (userId == null) {
    return res.status(400).send("Invalid auth token");
  }

  const gameId: string = req.body.context.gameId;
  const rollProcess = new RollProcessor(gameId, userId);
  await rollProcess.init();
  await rollProcess.completeMyTurn();

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

  const gameId: string = req.body.context.gameId;
  const bidAmount = parseInt(req.body.bid);
  const auction = new AuctionProcessor(bidAmount, gameId, userId);
  await auction.init();

  const errMsg = await auction.getErrMsg();
  if (errMsg) {
    return res.status(400).send(errMsg);
  }

  await auction.placeBid();

  res.json({
    status: "success",
  });
};
