import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { Treasure, TreasureDocument } from "../../core/schema/TreasureSchema";
import { Player } from "../../core/types/Player";

export class TreasureProcessor {
  private optNum: number;
  private gameId: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private treasure?: TreasureDocument | null;
  private player?: Player | null;

  constructor(
    optNum: number,
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ) {
    this.optNum = optNum;
    this.gameId = gameId;
    this.userId = userId;
  }

  public async init(): Promise<void> {
    this.game = await GameInstance.findById(this.gameId);
    if (this.game && this.game.treasureId) {
      this.treasure = await Treasure.findById(this.game.treasureId);
    }
    if (this.game) {
      this.player = this.game.players.find(
        (p: Player) =>
          p._id && new mongoose.Types.ObjectId(p._id).equals(this.userId)
      );
    }
  }

  public async pickOption(): Promise<void> {
    if (!this.game || !this.treasure) {
      return;
    }

    const randomNum = Math.floor(Math.random() * 100) + 1;

    this.treasure.optionPicked = this.optNum;
    this.treasure.randomNum = randomNum;

    const neededToWin = this.getChanceToWin();

    console.log(
      "randonNum: %s optionPicked: %s neededToWin: %s",
      randomNum,
      this.optNum,
      neededToWin
    );

    if (randomNum <= neededToWin) {
      this.treasure.prize = this.getPrizeAmount();
      if (this.player) {
        console.log("won");
        this.player.money = this.player.money + this.treasure.prize;
      }
    } else {
      console.log("lost");
      this.treasure.prize = 0;
    }

    this.treasure.save();

    if (this.game) {
      this.game.treasureId = null;
      this.game.save();
    }
  }

  private getPrizeAmount(): number {
    if (!this.game || !this.treasure) {
      return 0;
    }

    if (this.optNum === 1) {
      return this.treasure.option1Amount;
    }
    if (this.optNum === 2) {
      return this.treasure.option2Amount;
    }
    if (this.optNum === 3) {
      return this.treasure.option3Amount;
    }

    return 0;
  }

  private getChanceToWin(): number {
    if (!this.game || !this.treasure) {
      return 0;
    }

    if (this.optNum === 1) {
      return this.treasure.option1Percent;
    }
    if (this.optNum === 2) {
      return this.treasure.option2Percent;
    }
    if (this.optNum === 3) {
      return this.treasure.option3Percent;
    }

    return 0;
  }

  public async getErrMsg(): Promise<string> {
    if (this.game == null) {
      return "game not found";
    }
    if (this.game.treasureId == null) {
      return "no active treasure";
    }

    const playerToPick = this.game.players.find(
      (p) => p._id && new mongoose.Types.ObjectId(p._id).equals(this.userId)
    );
    if (playerToPick == null) {
      return "player not found!";
    }

    if (this.treasure == null) {
      return "treasure not found";
    }
    if (this.treasure.prize) {
      return "treasure is finished";
    }

    if (this.optNum < 1 || this.optNum > 3) {
      return "invalid picked option";
    }

    return "";
  }

  public static async getTreasure(
    treasureId: mongoose.Types.ObjectId
  ): Promise<TreasureDocument> {
    return await Treasure.findById(
      treasureId,
      (err: mongoose.CallbackError, existingTreasure: TreasureDocument) => {
        if (err) {
          return console.log(err);
        }
        return existingTreasure;
      }
    );
  }

  public static async createTreasure(
    gameId: mongoose.Types.ObjectId,
    player: Player
  ): Promise<mongoose.Types.ObjectId> {
    //TODO modify this for luck attributes, etc
    //make prize amounts random

    const newTreasure: TreasureDocument = new Treasure({
      gameId: gameId,
      playerId: player._id,
      playerName: player.name,
      playerColor: player.color,
      option1Amount: 100,
      option1Percent: 50,
      option2Amount: 300,
      option2Percent: 20,
      option3Amount: 500,
      option3Percent: 10,
    });

    await newTreasure.save();
    return new mongoose.Types.ObjectId(newTreasure._id);
  }
}
