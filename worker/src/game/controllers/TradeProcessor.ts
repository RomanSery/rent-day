import { Player } from "@core/types/Player";
import { TradeParticipant } from "@core/types/TradeParticipant";
import { TradeStatus } from "@core/enums/TradeStatus";
import { GameStatus } from "@core/enums/GameStatus";
import { SquareGameData } from "@core/types/SquareGameData";
import { PlayerState } from "@core/enums/PlayerState";
import { SquareConfigDataMap } from "@core/config/SquareData";
import { formatISO } from "date-fns";
import { GameInstanceDocument, TradeDocument } from "../model";
import { GameContext } from "../GameContext";
import { newId } from "../ids";
import { areIdsEqual, doesGroupHaveAnyHouses } from "./helpers";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";

export class TradeProcessor {
  private ctx: GameContext;
  private userId: string;
  private tradingWithPlayerId: string;
  private mines: number[];
  private theirs: number[];
  private myAmount: number;
  private theirAmount: number;

  private game?: GameInstanceDocument | null;
  private me?: Player | null;
  private otherPlayer?: Player | null;
  private newTradeId?: string | null;

  constructor(
    ctx: GameContext,
    userId: string,
    tradingWithPlayerId: string,
    mines: number[],
    theirs: number[],
    myAmount: number,
    theirAmount: number
  ) {
    this.ctx = ctx;
    this.userId = userId;
    this.tradingWithPlayerId = tradingWithPlayerId;
    this.mines = mines;
    this.theirs = theirs;
    this.myAmount = myAmount;
    this.theirAmount = theirAmount;
  }

  private async init(): Promise<void> {
    this.game = await this.ctx.store.getGame();
    if (this.game) {
      this.me = this.game.players.find(
        (p: Player) => p._id && areIdsEqual(p._id, this.userId)
      );

      this.otherPlayer = this.game.players.find(
        (p: Player) => p._id && areIdsEqual(p._id, this.tradingWithPlayerId)
      );
    }
  }

  public getNewTradeId(): string | null {
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

    if (this.myAmount < 0) {
      return "Can't give less than $0";
    }

    if (this.myAmount > 0 && this.myAmount > this.me.money) {
      return "Can't give more than you have";
    }

    if (this.theirAmount < 0) {
      return "They can't give less than $0";
    }
    if (this.theirAmount > 0 && this.theirAmount > this.otherPlayer.money) {
      return "Can't get more than they have";
    }

    if (this.mines.length === 0 && this.myAmount === 0) {
      return "You must offer something";
    }

    if (this.theirs.length === 0 && this.theirAmount === 0) {
      return "You must get something in return";
    }

    for (const squareId of this.mines) {
      const state: SquareGameData | undefined = this.game!.squareState.find(
        (p: SquareGameData) => p.squareId === squareId
      );
      if (!state || !state.owner) {
        return "You dont own some of the properties you are trying to trade.";
      }
      if (!areIdsEqual(state.owner, this.me!._id)) {
        return "You dont own some of the properties you are trying to trade.";
      }

      if (state.numHouses > 0) {
        return "You cant trade properties with houses on them. Sell them first";
      }

      const squareConfig = SquareConfigDataMap.get(squareId);
      if (
        squareConfig &&
        squareConfig.groupId &&
        doesGroupHaveAnyHouses(this.game, squareConfig.groupId)
      ) {
        return "You cant trade a property that belongs to a group with houses. Sell them first";
      }
    }

    for (const squareId of this.theirs) {
      const state: SquareGameData | undefined = this.game!.squareState.find(
        (p: SquareGameData) => p.squareId === squareId
      );
      if (!state || !state.owner) {
        return "They dont own some of the properties you are trying to trade.";
      }
      if (!areIdsEqual(state.owner, this.otherPlayer!._id)) {
        return "They dont own some of the properties you are trying to trade.";
      }

      if (state.numHouses > 0) {
        return "They cant trade properties with houses on them. Sell them first";
      }

      const squareConfig = SquareConfigDataMap.get(squareId);
      if (
        squareConfig &&
        squareConfig.groupId &&
        doesGroupHaveAnyHouses(this.game, squareConfig.groupId)
      ) {
        return "They cant trade a property that belongs to a group with houses. Sell them first";
      }
    }

    const me: TradeParticipant = {
      playerId: this.userId,
      playerName: this.me.name,
      playerColor: this.me.color,
      amountGiven: this.myAmount,
      squaresGiven: this.mines,
    };

    const them: TradeParticipant = {
      playerId: this.tradingWithPlayerId,
      playerName: this.otherPlayer.name,
      playerColor: this.otherPlayer.color,
      amountGiven: this.theirAmount,
      squaresGiven: this.theirs,
    };

    const newTrade: TradeDocument = {
      _id: newId(),
      gameId: this.game._id,
      participant1: me,
      participant2: them,
      status: TradeStatus.OFFERED,
      createdAt: formatISO(new Date()),
    };

    await this.ctx.store.saveTrade(newTrade);
    this.newTradeId = newTrade._id;

    return "";
  }

  public static async getTrade(
    ctx: GameContext,
    tradeId: string
  ): Promise<TradeDocument | null> {
    return await ctx.store.getTrade(tradeId);
  }

  public static async acceptTrade(
    ctx: GameContext,
    userId: string,
    tradeId: string,
    gameId: string
  ): Promise<string> {
    const tradeDoc: TradeDocument | null = await this.getTrade(ctx, tradeId);
    if (!tradeDoc) {
      return "Trade not found";
    }

    if (tradeDoc.status === TradeStatus.ACCEPTED) {
      return "Trade already accepted";
    }
    if (tradeDoc.status === TradeStatus.DECLINED) {
      return "Trade already declined";
    }

    if (!areIdsEqual(gameId, tradeDoc.gameId)) {
      return "GameId/TradeId mismatch";
    }

    if (!areIdsEqual(userId, tradeDoc.participant2.playerId)) {
      return "You can't accept this trade";
    }

    const game: GameInstanceDocument | null = await ctx.store.getGame();
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

    if (tradeDoc.participant1.amountGiven < 0) {
      return "Can't give less than $0";
    }

    if (
      tradeDoc.participant1.amountGiven > 0 &&
      tradeDoc.participant1.amountGiven > participant1.money
    ) {
      return "Can't give more than you have";
    }

    if (tradeDoc.participant2.amountGiven < 0) {
      return "They can't give less than $0";
    }
    if (
      tradeDoc.participant2.amountGiven > 0 &&
      tradeDoc.participant2.amountGiven > participant2.money
    ) {
      return "Can't get more than they have";
    }

    for (const squareId of tradeDoc.participant1.squaresGiven) {
      const state: SquareGameData | undefined = game.squareState.find(
        (p: SquareGameData) => p.squareId === squareId
      );
      if (!state || !state.owner) {
        return "You dont own some of the properties you are trying to trade.";
      }
      if (!areIdsEqual(state.owner, tradeDoc.participant1.playerId)) {
        return "You dont own some of the properties you are trying to trade.";
      }
      if (state.numHouses > 0) {
        return "You cant trade properties with houses on them. Sell them first";
      }

      const squareConfig = SquareConfigDataMap.get(squareId);
      if (
        squareConfig &&
        squareConfig.groupId &&
        doesGroupHaveAnyHouses(game, squareConfig.groupId)
      ) {
        return "You cant trade a property that belongs to a group with houses. Sell them first";
      }
    }

    for (const squareId of tradeDoc.participant2.squaresGiven) {
      const state: SquareGameData | undefined = game.squareState.find(
        (p: SquareGameData) => p.squareId === squareId
      );
      if (!state || !state.owner) {
        return "They dont own some of the properties you are trying to trade.";
      }
      if (!areIdsEqual(state.owner, tradeDoc.participant2.playerId)) {
        return "They dont own some of the properties you are trying to trade.";
      }
      if (state.numHouses > 0) {
        return "They cant trade properties with houses on them. Sell them first";
      }

      const squareConfig = SquareConfigDataMap.get(squareId);
      if (
        squareConfig &&
        squareConfig.groupId &&
        doesGroupHaveAnyHouses(game, squareConfig.groupId)
      ) {
        return "They cant trade a property that belongs to a group with houses. Sell them first";
      }
    }

    tradeDoc.status = TradeStatus.ACCEPTED;
    await ctx.store.saveTrade(tradeDoc);

    await TradeProcessor.doTradeTransfer(ctx, game, tradeDoc);

    return "";
  }

  private static async doTradeTransfer(
    ctx: GameContext,
    game: GameInstanceDocument,
    tradeDoc: TradeDocument
  ): Promise<void> {
    const player1 = game.players.find((p: Player) =>
      areIdsEqual(p._id, tradeDoc.participant1.playerId)
    )!;

    const player2 = game.players.find((p: Player) =>
      areIdsEqual(p._id, tradeDoc.participant2.playerId)
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

    await ctx.store.saveGame(game);
  }

  public static async declineTrade(
    ctx: GameContext,
    userId: string,
    tradeId: string,
    gameId: string
  ): Promise<string> {
    const tradeDoc: TradeDocument | null = await this.getTrade(ctx, tradeId);
    if (!tradeDoc) {
      return "trade not found";
    }

    if (tradeDoc.status === TradeStatus.ACCEPTED) {
      return "Trade already accepted";
    }
    if (tradeDoc.status === TradeStatus.DECLINED) {
      return "Trade already declined";
    }

    if (!areIdsEqual(gameId, tradeDoc.gameId)) {
      return "GameId/TradeId mismatch";
    }

    if (!areIdsEqual(userId, tradeDoc.participant2.playerId)) {
      return "You can't decline this trade";
    }

    const game: GameInstanceDocument | null = await ctx.store.getGame();
    if (!game) {
      return "Game not found";
    }
    if (game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }

    tradeDoc.status = TradeStatus.DECLINED;
    await ctx.store.saveTrade(tradeDoc);

    return "";
  }
}
