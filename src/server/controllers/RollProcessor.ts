import { AuctionDocument } from "../../core/schema/AuctionSchema";
import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { Player } from "../../core/types/Player";
import { DiceRoll } from "../../core/types/DiceRoll";
import { SquareType } from "../../core/enums/SquareType";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareGameData } from "../../core/types/SquareGameData";
import { TreasureProcessor } from "./TreasureProcessor";
import { AuctionProcessor } from "./AuctionProcessor";
import { PlayerState } from "../../core/enums/PlayerState";

export class RollProcessor {
  private gameId: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private player?: Player | null;
  private playerPassedPayDay: boolean;

  private static isolation_position = 11;

  constructor(
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ) {
    this.gameId = gameId;
    this.userId = userId;
    this.playerPassedPayDay = false;
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

    this.updateRollHistory();

    let newPosition = this.getNewPlayerPosition();
    this.player.position = newPosition;
    if (!this.player.lastRoll!.isDouble()) {
      this.player.hasRolled = true;
    }

    if (this.playerPassedPayDay === true) {
      this.playerPassedGo();
    }

    if (this.shouldCreateAuction()) {
      const newAuction: AuctionDocument = await AuctionProcessor.createAuction(
        this.game,
        this.player
      );
      this.game.auctionId = new mongoose.Types.ObjectId(newAuction._id);
      this.game.auctionSquareId = newAuction.squareId;
    } else if (this.shouldCreateTreasure()) {
      this.game.treasureId = await TreasureProcessor.createTreasure(
        this.game.id,
        this.player
      );
    }

    const squareId: number = this.player.position;
    const squareConfig = SquareConfigDataMap.get(squareId);
    const squareTheme = this.game.theme.get(squareId.toString());
    let squareName = squareTheme ? squareTheme.name : "";
    if (squareConfig && squareConfig.type === SquareType.Chance) {
      squareName = "Chance";
    } else if (squareConfig && squareConfig.type === SquareType.Isolation) {
      squareName = "Visiting Isolation";
    } else if (squareConfig && squareConfig.type === SquareType.Treasure) {
      squareName = "Treasure";
    }

    let desc = this.player.name + " landed on " + squareName;
    if (this.player.lastRoll!.isDouble()) {
      desc += " <br /> rolled a double so go again";
    }

    this.game.results = {
      roll: this.player.lastRoll!,
      description: desc,
    };

    this.game.save();
  }

  private getNewPlayerPosition(): number {
    if (this.hasRolledThreeConsecutiveDoubles()) {
      this.playerPassedPayDay = false;
      this.player!.state = PlayerState.IN_ISOLATION;
      return RollProcessor.isolation_position;
    }

    let newPosition = this.player!.position + this.player!.lastRoll!.sum();
    if (newPosition > 39) {
      newPosition = newPosition - 39;
      this.playerPassedPayDay = true;
    } else {
      this.playerPassedPayDay = false;
    }

    return newPosition;
  }

  private updateRollHistory(): void {
    if (!this.player) {
      return;
    }

    const newRoll = new DiceRoll();
    this.player.lastRoll = newRoll;

    if (this.player.secondRoll != null) {
      this.player.thirdRoll = this.player.secondRoll;
    }
    if (this.player.lastRoll != null) {
      this.player.secondRoll = this.player.lastRoll;
    }
  }

  private hasRolledThreeConsecutiveDoubles(): boolean {
    if (!this.player) {
      return false;
    }

    if (!this.player.lastRoll || !this.player.lastRoll.isDouble()) {
      return false;
    }
    if (!this.player.secondRoll || !this.player.secondRoll.isDouble()) {
      return false;
    }
    if (!this.player.thirdRoll || !this.player.thirdRoll.isDouble()) {
      return false;
    }

    return true;
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

    const squareData: SquareGameData | undefined = this.game.squareState.find(
      (p: SquareGameData) => p.squareId === squareId
    );
    if (squareData == null) {
      return true;
    }
    if (squareData.owner == null) {
      return true;
    }

    return false;
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

    if (this.player.state === PlayerState.IN_ISOLATION) {
      return "You are in quarantine and can't roll";
    }

    //TODO if is in Isolation, cant roll
    //TODO if negative $, cant roll
    //etc

    return "";
  }
}
