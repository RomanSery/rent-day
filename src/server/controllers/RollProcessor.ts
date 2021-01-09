import { Auction, AuctionDocument } from "../../core/schema/AuctionSchema";
import { Treasure, TreasureDocument } from "../../core/schema/TreasureSchema";
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
  private gameId: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private player?: Player | null;

  constructor(
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ) {
    this.gameId = gameId;
    this.userId = userId;
  }

  public async init(): Promise<void> {
    this.game = await GameInstance.findById(this.gameId);
    if (this.game) {
      this.player = this.game.players.find(
        (p: Player) =>
          p._id && new mongoose.Types.ObjectId(p._id).equals(this.userId)
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
      const newAuction: AuctionDocument = new Auction({
        gameId: this.game.id,
        squareId: this.player.position,
        finished: false,
        bidders: this.getBidders(),
      });

      await newAuction.save();
      this.game.auctionId = new mongoose.Types.ObjectId(newAuction._id);
      this.game.auctionSquareId = newAuction.squareId;
    } else if (this.shouldCreateTreasure()) {
      const newTreasure: TreasureDocument = new Treasure({
        gameId: this.game.id,
        playerId: this.userId,
        option1Amount: 100,
        option1Percent: 50,
        option2Amount: 300,
        option2Percent: 20,
        option3Amount: 500,
        option3Percent: 10,
      });

      await newTreasure.save();
      this.game.treasureId = new mongoose.Types.ObjectId(newTreasure._id);
    }

    const squareId: number = this.player.position;
    const squareConfig = SquareConfigDataMap.get(squareId);
    const squareTheme = this.game.theme.get(squareId.toString());
    let squareName = squareTheme ? squareTheme.name : "";
    if (squareConfig && squareConfig.type === SquareType.Chance) {
      squareName = "Chance";
    } else if (squareConfig && squareConfig.type === SquareType.Jail) {
      squareName = "Visiting Jail";
    } else if (squareConfig && squareConfig.type === SquareType.Treasure) {
      squareName = "Treasure";
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

    if (!this.userId.equals(this.game.nextPlayerToAct)) {
      console.log("not %s's turn", this.player.name);
      return;
    }

    if (!this.player.hasRolled) {
      console.log("%s didnt roll yet", this.player.name);
      return;
    }

    const nextPlayer: mongoose.Types.ObjectId | null = this.getNextPlayerToAct();
    if (nextPlayer) {
      this.game.nextPlayerToAct = nextPlayer;
    }

    this.player.hasRolled = false;

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

    this.game.players.forEach((p: Player, key: number) => {
      if (p.state === PlayerState.ACTIVE || p.state === PlayerState.IN_JAIL) {
        const newBidder: Bidder = {
          name: p.name,
          type: p.type,
          color: p.color,
          _id: p._id,
          submittedBid: false,
        };
        bidders.push(newBidder);
      }
    });

    return bidders;
  }

  private shouldCreateTreasure(): boolean {
    if (!this.player || !this.game) {
      return false;
    }

    const squareId: number = this.player.position;
    const squareConfig = SquareConfigDataMap.get(squareId);
    if (!squareConfig) {
      return false;
    }

    return squareConfig.type === SquareType.Treasure;
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

    if (!this.userId.equals(this.game.nextPlayerToAct)) {
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
