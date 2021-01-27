import { Trade, TradeDocument } from "../../core/schema/TradeSchema";
import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { Player } from "../../core/types/Player";
import { TradeParticipant } from "../../core/types/TradeParticipant";

export class TradeProcessor {
  private gameId: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;
  private tradingWithPlayerId: mongoose.Types.ObjectId;
  private mines: number[];
  private theirs: number[];
  private myAmount: number;
  private theirAmount: number;

  private game?: GameInstanceDocument | null;
  private me?: Player | null;
  private otherPlayer?: Player | null;
  private newTradeId?: mongoose.Types.ObjectId | null;

  constructor(
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    tradingWithPlayerId: mongoose.Types.ObjectId,
    mines: number[],
    theirs: number[],
    myAmount: number,
    theirAmount: number
  ) {
    this.gameId = gameId;
    this.userId = userId;
    this.tradingWithPlayerId = tradingWithPlayerId;
    this.mines = mines;
    this.theirs = theirs;
    this.myAmount = myAmount;
    this.theirAmount = theirAmount;
  }

  private async init(): Promise<void> {
    this.game = await GameInstance.findById(this.gameId);
    if (this.game) {
      this.me = this.game.players.find(
        (p: Player) =>
          p._id && new mongoose.Types.ObjectId(p._id).equals(this.userId)
      );

      this.otherPlayer = this.game.players.find(
        (p: Player) =>
          p._id &&
          new mongoose.Types.ObjectId(p._id).equals(this.tradingWithPlayerId)
      );
    }
  }

  public getNewTradeId(): mongoose.Types.ObjectId | null {
    if (this.newTradeId) {
      return this.newTradeId;
    }
    return null;
  }

  public async offerTrade(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (!this.me || !this.otherPlayer) {
      return "player not owned";
    }

    if (this.myAmount < 0 || this.myAmount > this.me.money) {
      return "Can't give more than you have";
    }

    if (this.theirAmount < 0 || this.theirAmount > this.otherPlayer.money) {
      return "Can't get more than they have";
    }

    if (this.mines.length === 0 && this.myAmount === 0) {
      return "You must offer something";
    }

    if (this.theirs.length === 0 && this.theirAmount === 0) {
      return "You must get something in return";
    }

    const me: TradeParticipant = {
      playerId: this.userId.toHexString(),
      playerName: this.me.name,
      playerColor: this.me.color,
      amountGiven: this.myAmount,
      squaresGiven: this.mines,
    };

    const them: TradeParticipant = {
      playerId: this.tradingWithPlayerId.toHexString(),
      playerName: this.otherPlayer.name,
      playerColor: this.otherPlayer.color,
      amountGiven: this.theirAmount,
      squaresGiven: this.theirs,
    };

    const newTrade: TradeDocument = new Trade({
      gameId: this.gameId,
      participant1: me,
      participant2: them,
      accepted: false,
    });

    await newTrade.save();
    this.newTradeId = newTrade.id;

    return "";
  }

  public static async getTrade(
    tradeId: mongoose.Types.ObjectId
  ): Promise<TradeDocument> {
    return await Trade.findById(
      tradeId,
      (err: mongoose.CallbackError, existingTrade: TradeDocument) => {
        if (err) {
          return console.log(err);
        }
        return existingTrade;
      }
    );
  }
}
