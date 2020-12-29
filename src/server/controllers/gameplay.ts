/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import mongoose from "mongoose";
import { Request, Response } from "express";
import { GameInstance } from "../../core/schema/GameInstanceSchema";
import { Auction } from "../../core/schema/AuctionSchema";
import { DiceRoll } from "../../core/types/DiceRoll";
import { GameContext } from "../../core/types/GameContext";
import { Player } from "../../core/types/Player";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { Bidder } from "../../core/types/Bidder";
import { PlayerState } from "../../core/enums/PlayerState";
import { check } from "express-validator";

export const roll = async (req: Request, res: Response) => {
  const context: GameContext = getGameContextFromUrl(req);

  const gameId: string = context.gameId;
  const playerId: string = context.playerId;

  let existingGame = await GameInstance.findById(gameId);

  if (existingGame == null) {
    return res.status(400).send("game not found");
  }

  const playerObjId = new mongoose.Types.ObjectId(context.playerId);
  if (!playerObjId.equals(existingGame.nextPlayerToAct)) {
    console.log("not your turn!");
    return res.status(400).send("not your turn!");
  }

  const newRoll = new DiceRoll();

  const playerToAct = existingGame.players.find(
    (p: Player) => p._id && p._id.toString() === playerId
  );
  if (playerToAct == null) {
    console.log("player not found!");
    return res.status(400).send("player not found!");
  }

  console.log(playerToAct.name + " is rolling: " + newRoll.prettyPrint());

  let newPosition = playerToAct.position + newRoll.sum();
  if (newPosition >= 39) {
    newPosition = newPosition - 39;
    playerPassedGo(playerToAct);
  }
  playerToAct.position = newPosition;

  //set auction mode if applicable
  const squareId: number = playerToAct.position;
  const squareConfig = SquareConfigDataMap.get(squareId);
  if (
    squareConfig &&
    (squareConfig.type == SquareType.Property ||
      squareConfig.type == SquareType.TrainStation ||
      squareConfig.type == SquareType.Utility)
  ) {
    const squareData = existingGame.squareState.get(squareId.toString());
    if (squareData) {
      console.log("owner: " + squareData.owner);
    }

    if ((squareData && squareData.owner == null) || squareData == null) {
      console.log("start auction mode");

      const bidders: Array<Bidder> = new Array();

      existingGame.players.forEach((value: Player, key: number) => {
        if (
          value.state == PlayerState.ACTIVE ||
          value.state == PlayerState.IN_JAIL
        ) {
          const newBidder = {
            name: value.name,
            type: value.type,
            color: value.color,
            _id: value._id,
          };
          bidders.push(newBidder);
        }
      });

      const newAuction = new Auction({
        gameId: existingGame.id,
        squareId: squareId,
        finished: false,
        bidders: bidders,
      });

      console.log("saving new auction");
      await newAuction.save();

      existingGame.auctionId = new mongoose.Types.ObjectId(newAuction._id);
    }
  }

  //set next player to act
  const index = existingGame.players.indexOf(playerToAct);
  const nextPlayer =
    index < existingGame.players.length - 1
      ? existingGame.players[index + 1]
      : existingGame.players[0];
  existingGame.nextPlayerToAct = new mongoose.Types.ObjectId(nextPlayer._id);
  console.log("next player to act: %s", nextPlayer.name);

  existingGame.results = {
    roll: newRoll,
    description: playerToAct.name + " rolled a: " + newRoll.prettyPrint(),
  };

  existingGame.save();

  res.json({
    status: "success",
  });
};

export const bid = async (req: Request, res: Response) => {
  await check("bid", "Bid is not valid").notEmpty().isNumeric().run(req);

  const context: GameContext = getGameContextFromUrl(req);
  const bidAmount = parseInt(req.body.bid);
  //const auction = new AuctionProcessor(bidAmount, context);

  //const errMsg = auction.getErrMsg();
  //if (errMsg) {
  //return res.status(400).send(errMsg);
  //}

  //auction.placeBid();

  res.json({
    status: "success",
  });
};

const playerPassedGo = (player: Player) => {
  player.money = player.money + 200;
};

const getGameContextFromUrl = (req: Request): GameContext => {
  const gid: any = req.body.context.gameId;
  const pid: any = req.body.context.playerId;

  return { gameId: gid, playerId: pid };
};
