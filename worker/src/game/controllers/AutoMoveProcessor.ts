import { Player } from "@core/types/Player";
import { PlayerState } from "@core/enums/PlayerState";
import { GameStatus } from "@core/enums/GameStatus";
import { isFuture, parseISO } from "date-fns";
import { DiceRoll } from "@core/types/DiceRoll";
import { maxTimeoutsAllowed } from "@core/constants";
import { GameInstanceDocument } from "../model";
import { GameContext } from "../GameContext";
import { RollProcessor } from "./RollProcessor";
import { GameProcessor } from "./GameProcessor";
import { AuctionProcessor } from "./AuctionProcessor";
import { areIdsEqual } from "./helpers";
import { Liquidation } from "./Liquidation";

export class AutoMoveProcessor {
  private ctx: GameContext;
  private game?: GameInstanceDocument | null;
  private player?: Player | null;

  private lastDiceRoll: DiceRoll | undefined;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
  }

  private async init(): Promise<void> {
    this.game = await this.ctx.store.getGame();
    if (this.game) {
      this.player = this.game.players.find(
        (p: Player) => p._id && areIdsEqual(p._id, this.game!.nextPlayerToAct)
      );
    }
  }

  public getLastDiceRoll(): DiceRoll | undefined {
    return this.lastDiceRoll;
  }
  public getPlayerId(): string | undefined {
    return this.player ? this.player._id : undefined;
  }

  public async autoMove(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (!this.game.settings.useTimers) {
      return "";
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
      if (this.player.totalAssets <= 0) {
        await GameProcessor.bankruptPlayer(
          this.ctx,
          this.game,
          this.game.nextPlayerToAct
        );
        await this.ctx.store.saveGame(this.game);
        return "";
      } else {
        await this.autoSell();
      }
    }

    if (this.player.money < 0 || this.player.totalAssets <= 0) {
      await GameProcessor.bankruptPlayer(
        this.ctx,
        this.game,
        this.game.nextPlayerToAct
      );
      await this.ctx.store.saveGame(this.game);
      return "";
    }

    if (this.player.numTimeouts >= maxTimeoutsAllowed) {
      await GameProcessor.bankruptPlayer(
        this.ctx,
        this.game,
        this.game.nextPlayerToAct
      );
      await this.ctx.store.saveGame(this.game);
      return "";
    }

    const processor = new RollProcessor(
      this.ctx,
      this.game.nextPlayerToAct!,
      null,
      null
    );

    if (this.player.hasRolled && !this.game.auctionId) {
      await processor.completeMyTurn(true, false);
      this.lastDiceRoll = processor.getLastDiceRoll();
      return "";
    }

    const errMsg = await processor.roll(true, true);
    if (errMsg && errMsg.length > 0) {
      return "";
    }

    this.lastDiceRoll = processor.getLastDiceRoll();

    return "";
  }

  private async autoBid(): Promise<string> {
    const processor = new AuctionProcessor(
      this.ctx,
      0,
      this.game!.nextPlayerToAct!
    );
    return await processor.autoBid();
  }

  private async autoSell(): Promise<void> {
    await Liquidation.raiseCash(this.ctx, this.game!, this.player!, 0);
  }
}
