/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Request, Response } from "express";
import { GameContext } from "../../core/types/GameContext";
import { check } from "express-validator";
import { getGameContextFromUrl } from "./helpers";
import { AuctionProcessor } from "./AuctionProcessor";
import { RollProcessor } from "./RollProcessor";

export const roll = async (req: Request, res: Response) => {
  const context: GameContext = getGameContextFromUrl(req);
  const rollProcess = new RollProcessor(context);
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
  const context: GameContext = getGameContextFromUrl(req);
  const rollProcess = new RollProcessor(context);
  await rollProcess.init();
  await rollProcess.completeMyTurn();

  res.json({
    status: "success",
  });
};

export const bid = async (req: Request, res: Response) => {
  await check("bid", "Bid is not valid").notEmpty().isNumeric().run(req);

  const context: GameContext = getGameContextFromUrl(req);
  const bidAmount = parseInt(req.body.bid);
  const auction = new AuctionProcessor(bidAmount, context);
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
