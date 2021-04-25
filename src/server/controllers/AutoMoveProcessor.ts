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
import { LottoProcessor } from "./LottoProcessor";
import { GameProcessor } from "./GameProcessor";

export class AutoMoveProcessor {
  private gameId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private player?: Player | null;
  private forceDie1: number | null;
  private forceDie2: number | null;

  private lastDiceRoll: DiceRoll | undefined;

  constructor(
    gameId: mongoose.Types.ObjectId,
    forceDie1: number | null,
    forceDie2: number | null
  ) {
    this.gameId = gameId;
    this.forceDie1 = forceDie1;
    this.forceDie2 = forceDie2;
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
    if (!this.player) {
      return "player not found";
    }
    if (this.player.state === PlayerState.BANKRUPT) {
      return this.player.name + " is bankrupt";
    }

    if (!this.game.nextPlayerActBy) {
      console.log("no turn timer yet");
      return "";
    }

    const actBy = parseISO(this.game.nextPlayerActBy);
    if (isFuture(actBy)) {
      console.log("turn timer not up yet for " + this.player.name);
      return "";
    }

    if (this.game && this.game.lottoId) {
      this.completeLotto();
    }

    if (this.player.money < 0) {
      await GameProcessor.bankruptPlayer(this.game, this.game.nextPlayerToAct);
      await this.game.save();
      return "";
    }

    const processor = new RollProcessor(
      this.gameId,
      this.game.nextPlayerToAct,
      this.forceDie1,
      this.forceDie2
    );

    if (this.player.hasRolled) {
      const errMsg = await processor.completeMyTurn();
      console.log(
        "(1) completing turn for " + this.player.name + " err=" + errMsg
      );
      return "";
    }

    const errMsg = await processor.roll(true);
    console.log(
      "(2) rolling and completing turn for " +
        this.player.name +
        " err=" +
        errMsg
    );
    if (errMsg && errMsg.length > 0) {
      return "";
    }

    this.lastDiceRoll = processor.getLastDiceRoll();

    return "";
  }

  private async completeLotto(): Promise<void> {
    const lotto = new LottoProcessor(
      1,
      this.gameId,
      new mongoose.Types.ObjectId(this.player!._id)
    );

    await lotto.pickOption();
  }
}
