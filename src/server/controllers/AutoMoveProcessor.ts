import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { Player } from "../../core/types/Player";
import { PlayerState } from "../../core/enums/PlayerState";

import { GameStatus } from "../../core/enums/GameStatus";
import { isFuture, parseISO } from "date-fns";
import { RollProcessor } from "./RollProcessor";
import { DiceRoll } from "../../core/types/DiceRoll";
import { GameProcessor } from "./GameProcessor";
import { AuctionProcessor } from "./AuctionProcessor";

export class AutoMoveProcessor {
  private gameId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private player?: Player | null;

  private lastDiceRoll: DiceRoll | undefined;

  constructor(gameId: mongoose.Types.ObjectId) {
    this.gameId = gameId;
  }

  private async init(): Promise<void> {
    this.game = await GameInstance.findById(this.gameId);
    if (this.game) {
      this.player = this.game.players.find(
        (p: Player) =>
          p._id &&
          new mongoose.Types.ObjectId(p._id).equals(this.game!.nextPlayerToAct)
      );
    }
  }

  public getLastDiceRoll(): DiceRoll {
    return this.lastDiceRoll!;
  }
  public getPlayerId(): string {
    return this.player!._id;
  }

  public async autoMove(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }

    if (this.game.auctionId) {
      return this.autoBid();
    }

    if (!this.player) {
      return "player not found";
    }
    if (this.player.state === PlayerState.BANKRUPT) {
      return this.player.name + " is bankrupt";
    }

    if (!this.game.nextPlayerActBy) {
      return "";
    }

    const actBy = parseISO(this.game.nextPlayerActBy);
    if (isFuture(actBy)) {
      return "";
    }

    if (this.player.money < 0) {
      await GameProcessor.bankruptPlayer(this.game, this.game.nextPlayerToAct);
      await this.game.save();
      return "";
    }

    const processor = new RollProcessor(
      this.gameId,
      this.game.nextPlayerToAct,
      null,
      null
    );

    if (this.player.hasRolled) {
      await processor.completeMyTurn();
      this.lastDiceRoll = processor.getLastDiceRoll();
      return "";
    }

    const errMsg = await processor.roll(true);
    if (errMsg && errMsg.length > 0) {
      return "";
    }

    this.lastDiceRoll = processor.getLastDiceRoll();

    return "";
  }

  private async autoBid(): Promise<string> {
    const processor = new AuctionProcessor(
      0,
      this.gameId,
      this.game!.nextPlayerToAct
    );
    return await processor.autoBid();
  }
}
