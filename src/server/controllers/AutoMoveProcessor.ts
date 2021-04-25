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

export class AutoMoveProcessor {
  private gameId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private player?: Player | null;

  private lastDiceRoll: DiceRoll | undefined;
  private movementKeyframes: Array<number> = [];
  private needToAnimate: boolean = false;

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

  public getMovementKeyFrames(): Array<number> {
    return this.movementKeyframes;
  }
  public getNeedToAnimate(): boolean {
    return this.needToAnimate;
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
    if (!this.player) {
      return "player not found";
    }
    if (this.player.state === PlayerState.BANKRUPT) {
      return this.player.name + " is bankrupt";
    }

    if (!this.game.nextPlayerActBy) {
      return "no turn timer yet";
    }

    const actBy = parseISO(this.game.nextPlayerActBy);
    if (isFuture(actBy)) {
      return "turn timer not up yet for " + this.player.name;
    }

    //if (this.player.hasRolled) {
    //return "You already rolled this turn";
    //}

    //if (this.player.money < 0) {
    //return "you cant roll with negative money;";
    //}

    const processor = new RollProcessor(
      this.gameId,
      this.game.nextPlayerToAct,
      null,
      null
    );

    if (this.player.hasRolled) {
      const errMsg = await processor.completeMyTurn(true);
      if (errMsg && errMsg.length > 0) {
        return errMsg;
      }
      return "";
    }

    const errMsg = await processor.roll();
    if (errMsg && errMsg.length > 0) {
      return errMsg;
    }

    this.needToAnimate =
      processor.getOrigPosition() !== processor.getNewPosition() &&
      processor.getMovementKeyFrames() &&
      processor.getMovementKeyFrames().length > 0;

    this.lastDiceRoll = processor.getLastDiceRoll();
    this.movementKeyframes = processor.getMovementKeyFrames();

    return "";
  }
}
