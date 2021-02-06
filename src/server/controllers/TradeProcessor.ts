import { Trade, TradeDocument } from "../../core/schema/TradeSchema";
import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { Player } from "../../core/types/Player";
import { TradeParticipant } from "../../core/types/TradeParticipant";
import { TradeStatus } from "../../core/enums/TradeStatus";
import { GameProcessor } from "./GameProcessor";
import { GameStatus } from "../../core/enums/GameStatus";
import { SquareGameData } from "../../core/types/SquareGameData";
import { PlayerState } from "../../core/enums/PlayerState";
import { areIdsEqual } from "./helpers";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";

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
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (!this.me || !this.otherPlayer) {
      return "player(s) not found";
    }
    if (this.me.state === PlayerState.BANKRUPT) {
      return this.me.name + " is bankrupt";
    }
    if (this.otherPlayer.state === PlayerState.BANKRUPT) {
      return this.otherPlayer.name + " is bankrupt";
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

    this.mines.forEach((squareId) => {
      const state: SquareGameData | undefined = this.game!.squareState.find(
        (p: SquareGameData) => p.squareId === squareId
      );
      if (!state || !state.owner) {
        return "You dont own some of the properties you are trying to trade.";
      }
      if (!areIdsEqual(state.owner, this.me!._id)) {
        return "You dont own some of the properties you are trying to trade.";
      }
    });

    this.theirs.forEach((squareId) => {
      const state: SquareGameData | undefined = this.game!.squareState.find(
        (p: SquareGameData) => p.squareId === squareId
      );
      if (!state || !state.owner) {
        return "They dont own some of the properties you are trying to trade.";
      }
      if (!areIdsEqual(state.owner, this.otherPlayer!._id)) {
        return "They dont own some of the properties you are trying to trade.";
      }
    });

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
      status: TradeStatus.OFFERED,
    });

    await newTrade.save();
    this.newTradeId = newTrade.id;

    return "";
  }

  public static async getTrade(
    tradeId: mongoose.Types.ObjectId
  ): Promise<TradeDocument | null> {
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

  public static async acceptTrade(
    userId: mongoose.Types.ObjectId,
    tradeId: mongoose.Types.ObjectId,
    gameId: mongoose.Types.ObjectId
  ): Promise<string> {
    const tradeDoc: TradeDocument | null = await this.getTrade(tradeId);
    if (!tradeDoc) {
      return "Trade not found";
    }

    if (tradeDoc.status === TradeStatus.ACCEPTED) {
      return "Trade already accepted";
    }
    if (tradeDoc.status === TradeStatus.DECLINED) {
      return "Trade already declined";
    }

    if (!gameId.equals(tradeDoc.gameId)) {
      return "GameId/TradeId mismatch";
    }

    if (
      !userId.equals(
        new mongoose.Types.ObjectId(tradeDoc.participant2.playerId)
      )
    ) {
      return "You can't accept this trade";
    }

    const game: GameInstanceDocument | null = await GameProcessor.getGame(
      gameId
    );
    if (!game) {
      return "Game not found";
    }
    if (game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }

    const participant1 = game.players.find(
      (p: Player) => p._id && areIdsEqual(p._id, tradeDoc.participant1.playerId)
    );
    const participant2 = game.players.find(
      (p: Player) => p._id && areIdsEqual(p._id, tradeDoc.participant2.playerId)
    );
    if (!participant1 || !participant2) {
      return "Players not found";
    }

    if (participant1.state === PlayerState.BANKRUPT) {
      return participant1.name + " is bankrupt";
    }
    if (participant2.state === PlayerState.BANKRUPT) {
      return participant2.name + " is bankrupt";
    }

    if (
      tradeDoc.participant1.amountGiven < 0 ||
      tradeDoc.participant1.amountGiven > participant1.money
    ) {
      return "Can't give more than you have";
    }
    if (
      tradeDoc.participant2.amountGiven < 0 ||
      tradeDoc.participant2.amountGiven > participant2.money
    ) {
      return "Can't get more than they have";
    }

    tradeDoc.participant1.squaresGiven.forEach((squareId) => {
      const state: SquareGameData | undefined = game.squareState.find(
        (p: SquareGameData) => p.squareId === squareId
      );
      if (!state || !state.owner) {
        return "You dont own some of the properties you are trying to trade.";
      }
      if (!areIdsEqual(state.owner, tradeDoc.participant1.playerId)) {
        return "You dont own some of the properties you are trying to trade.";
      }
    });

    tradeDoc.participant2.squaresGiven.forEach((squareId) => {
      const state: SquareGameData | undefined = game.squareState.find(
        (p: SquareGameData) => p.squareId === squareId
      );
      if (!state || !state.owner) {
        return "They dont own some of the properties you are trying to trade.";
      }
      if (!areIdsEqual(state.owner, tradeDoc.participant2.playerId)) {
        return "They dont own some of the properties you are trying to trade.";
      }
    });

    //TODO cant trade properties with houses on them

    tradeDoc.status = TradeStatus.ACCEPTED;
    await tradeDoc.save();

    await TradeProcessor.doTradeTransfer(game, tradeDoc);

    return "";
  }

  private static async doTradeTransfer(
    game: GameInstanceDocument,
    tradeDoc: TradeDocument
  ): Promise<void> {
    const player1 = game.players.find((p: Player) =>
      new mongoose.Types.ObjectId(p._id).equals(
        new mongoose.Types.ObjectId(tradeDoc.participant1.playerId)
      )
    )!;

    const player2 = game.players.find((p: Player) =>
      new mongoose.Types.ObjectId(p._id).equals(
        new mongoose.Types.ObjectId(tradeDoc.participant2.playerId)
      )
    )!;

    player1!.money -= tradeDoc.participant1.amountGiven;
    player2!.money += tradeDoc.participant1.amountGiven;

    player2!.money -= tradeDoc.participant2.amountGiven;
    player1!.money += tradeDoc.participant2.amountGiven;

    const giveToPlayer2: number[] = tradeDoc.participant1.squaresGiven;
    const giveToPlayer1: number[] = tradeDoc.participant2.squaresGiven;

    giveToPlayer2.forEach((squareId) => {
      const state: SquareGameData | undefined = game.squareState.find(
        (p: SquareGameData) => p.squareId === squareId
      );
      if (state) {
        state.color = player2.color;
        state.owner = player2._id;
        state.numHouses = 0;
      }
    });

    giveToPlayer1.forEach((squareId) => {
      const state: SquareGameData | undefined = game.squareState.find(
        (p: SquareGameData) => p.squareId === squareId
      );
      if (state) {
        state.color = player1.color;
        state.owner = player1._id;
        state.numHouses = 0;
      }
    });

    PlayerCostsCalculator.updatePlayerCosts(game, player1);
    PlayerCostsCalculator.updatePlayerCosts(game, player2);

    await game.save();
  }

  public static async declineTrade(
    userId: mongoose.Types.ObjectId,
    tradeId: mongoose.Types.ObjectId,
    gameId: mongoose.Types.ObjectId
  ): Promise<string> {
    const tradeDoc: TradeDocument | null = await this.getTrade(tradeId);
    if (!tradeDoc) {
      return "trade not found";
    }

    if (tradeDoc.status === TradeStatus.ACCEPTED) {
      return "Trade already accepted";
    }
    if (tradeDoc.status === TradeStatus.DECLINED) {
      return "Trade already declined";
    }

    if (!gameId.equals(tradeDoc.gameId)) {
      return "GameId/TradeId mismatch";
    }

    if (
      !userId.equals(
        new mongoose.Types.ObjectId(tradeDoc.participant2.playerId)
      )
    ) {
      return "You can't decline this trade";
    }

    const game: GameInstanceDocument | null = await GameProcessor.getGame(
      gameId
    );
    if (!game) {
      return "Game not found";
    }
    if (game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }

    tradeDoc.status = TradeStatus.DECLINED;
    await tradeDoc.save();

    return "";
  }
}
