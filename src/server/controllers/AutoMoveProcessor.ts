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
import { maxTimeoutsAllowed } from "../../core/constants";
import { SquareGameData } from "../../core/types/SquareGameData";
import { areIdsEqual } from "./helpers";
import { PropertyProcessor } from "./PropertyProcessor";

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
      if(this.player.totalAssets <= 0) {
        await GameProcessor.bankruptPlayer(this.game, this.game.nextPlayerToAct);
        await this.game.save();
        return "";
      } else {        
        await this.autoSell();
      }      
    }

    if (this.player.money < 0 || this.player.totalAssets <= 0) {
      await GameProcessor.bankruptPlayer(this.game, this.game.nextPlayerToAct);
      await this.game.save();
      return "";
    }

    if (this.player.numTimeouts >= maxTimeoutsAllowed) {
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
      0,
      this.gameId,
      this.game!.nextPlayerToAct
    );
    return await processor.autoBid();
  }


  private async autoSell(): Promise<void> {

    //TODO have to auto sell houses/ mortgage properties

    while(this.player!.money < 0) {
      const sold = await this.tryToSellAHouse();
      if(!sold) {
        break;
      }
    }

    while(this.player!.money < 0) {
      const mortgaged = await this.tryToMortgageProperty();
      if(!mortgaged) {
        break;
      }
    }


  }


  private async tryToSellAHouse(): Promise<boolean> {    
    
      const playerOwnedSquaresWithHouses: SquareGameData[] = this.game!.squareState.filter(
        (s: SquareGameData) => {
          return (
            s.owner &&
            areIdsEqual(s.owner, this.player!._id) &&
            s.numHouses > 0 &&
            s.electricityCost &&
            s.electricityCost > 0 &&
            !s.isMortgaged
          );
        }
      );

      if(playerOwnedSquaresWithHouses.length === 0) {
        return false;
      }

      
      const playerId = new mongoose.Types.ObjectId(this.player!._id);
      const squareId = playerOwnedSquaresWithHouses[0].squareId;
      const processor = new PropertyProcessor(squareId, this.gameId, playerId);
      const errMsg = await processor.sellHouse();

      if (errMsg && errMsg.length > 0) {
        return false;
      }

      return true;
  }


  private async tryToMortgageProperty(): Promise<boolean> {    
    
    const playerOwnedSquares: SquareGameData[] = this.game!.squareState.filter(
      (s: SquareGameData) => {
        return (
          s.owner &&
          areIdsEqual(s.owner, this.player!._id) &&
          !s.isMortgaged &&
          s.mortgageValue &&
          s.mortgageValue > 0
        );
      }
    );

    if(playerOwnedSquares.length === 0) {
      return false;
    }

    
    const playerId = new mongoose.Types.ObjectId(this.player!._id);    
    const squareId = playerOwnedSquares[0].squareId;
    const processor = new PropertyProcessor(squareId, this.gameId, playerId);
    const errMsg = await processor.mortgageProperty();

    if (errMsg && errMsg.length > 0) {
      return false;
    }

    return true;
}

}
