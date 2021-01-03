import { Auction } from "../../core/schema/AuctionSchema";
import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { Bidder } from "../../core/types/Bidder";
import { Player } from "../../core/types/Player";
import { DiceRoll } from "../../core/types/DiceRoll";
import { PlayerState } from "../../core/enums/PlayerState";
import { SquareType } from "../../core/enums/SquareType";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareGameData } from "../../core/types/SquareGameData";

export class RollProcessor {
  private gameId: string;
  private userId: string;
  private game?: GameInstanceDocument | null;
  private player?: Player | null;

  constructor(gameId: string, userId: string) {
    this.gameId = gameId;
    this.userId = userId;
  }

  public async init(): Promise<void> {
    this.game = await GameInstance.findById(this.gameId);
    if (this.game) {
      this.player = this.game.players.find(
        (p: Player) => p._id && p._id.toString() === this.userId
      );
    }
  }

  public async roll(): Promise<void> {
    if (!this.game || !this.player) {
      return;
    }

    const newRoll = new DiceRoll();

    let newPosition = this.player.position + newRoll.sum();
    if (newPosition > 39) {
      newPosition = newPosition - 39;
      this.playerPassedGo();
    }
    this.player.position = newPosition;
    this.player.hasRolled = true;

    this.updateRollHistory(newRoll);

    if (this.shouldCreateAuction()) {
      const newAuction = new Auction({
        gameId: this.game.id,
        squareId: this.player.position,
        finished: false,
        bidders: this.getBidders(),
      });

      await newAuction.save();
      this.game.auctionId = new mongoose.Types.ObjectId(newAuction._id);
      this.game.auctionSquareId = newAuction.squareId;
    }

    const squareId: number = this.player.position;
    const squareConfig = SquareConfigDataMap.get(squareId);
    const squareTheme = this.game.theme.get(squareId.toString());
    let squareName = squareTheme ? squareTheme.name : "";
    if (squareConfig && squareConfig.type === SquareType.Chance) {
      squareName = "Chance";
    } else if (squareConfig && squareConfig.type === SquareType.Jail) {
      squareName = "Visiting Jail";
    }

    this.game.results = {
      roll: newRoll,
      description: this.player.name + " landed on " + squareName,
    };

    this.game.save();
  }

  private updateRollHistory(newRoll: DiceRoll): void {
    if (!this.player) {
      return;
    }

    if (this.player.secondRoll != null) {
      this.player.thirdRoll = this.player.secondRoll;
    }
    if (this.player.lastRoll != null) {
      this.player.secondRoll = this.player.lastRoll;
    }
    this.player.lastRoll = newRoll;
  }

  public async completeMyTurn(): Promise<void> {
    if (!this.game) {
      return;
    }
    if (!this.player) {
      return;
    }

    const playerObjId = new mongoose.Types.ObjectId(this.userId);
    if (!playerObjId.equals(this.game.nextPlayerToAct)) {
      //not your turn!
      return;
    }

    const nextPlayer: mongoose.Types.ObjectId | null = this.getNextPlayerToAct();
    if (nextPlayer) {
      this.game.nextPlayerToAct = nextPlayer;
    }

    this.player.hasRolled = true;

    this.game.save();
  }

  private shouldCreateAuction(): boolean {
    if (!this.player || !this.game) {
      return false;
    }

    const squareId: number = this.player.position;
    const squareConfig = SquareConfigDataMap.get(squareId);
    if (!squareConfig) {
      return false;
    }
    if (
      squareConfig.type !== SquareType.Property &&
      squareConfig.type !== SquareType.TrainStation &&
      squareConfig.type !== SquareType.Utility
    ) {
      return false;
    }

    if (!this.game.squareState) {
      this.game.squareState = new Map<string, SquareGameData>();
    }

    const squareData: SquareGameData | undefined = this.game.squareState.get(
      squareId.toString()
    );
    if (squareData == null) {
      return true;
    }
    if (squareData.owner == null) {
      return true;
    }

    return false;
  }

  private getBidders(): Array<Bidder> {
    if (!this.game) {
      return [];
    }
    const bidders: Array<Bidder> = [];

    this.game.players.forEach((value: Player, key: number) => {
      if (
        value.state === PlayerState.ACTIVE ||
        value.state === PlayerState.IN_JAIL
      ) {
        const newBidder: Bidder = {
          name: value.name,
          type: value.type,
          color: value.color,
          _id: value._id,
          submittedBid: false,
        };
        bidders.push(newBidder);
      }
    });

    return bidders;
  }

  private getNextPlayerToAct(): mongoose.Types.ObjectId | null {
    if (!this.game || !this.player) {
      return null;
    }
    const index = this.game.players.indexOf(this.player);
    const nextPlayer =
      index < this.game.players.length - 1
        ? this.game.players[index + 1]
        : this.game.players[0];
    return new mongoose.Types.ObjectId(nextPlayer._id);
  }

  private playerPassedGo(): void {
    if (this.player) {
      this.player.money = this.player.money + 200;
    }
  }

  public async getErrMsg(): Promise<string> {
    if (!this.game) {
      return "game not found";
    }
    if (!this.player) {
      return "player not found";
    }

    const playerObjId = new mongoose.Types.ObjectId(this.userId);
    if (!playerObjId.equals(this.game.nextPlayerToAct)) {
      return "not your turn!";
    }

    if (this.player.hasRolled) {
      return "You already rolled this turn";
    }

    //TODO if is in jail, cant roll
    //TODO if negative $, cant roll
    //etc

    return "";
  }
}