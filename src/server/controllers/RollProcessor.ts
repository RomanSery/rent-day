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
import { LottoProcessor } from "./LottoProcessor";
import { AuctionProcessor } from "./AuctionProcessor";
import { PlayerState } from "../../core/enums/PlayerState";
import { PropertyProcessor } from "./PropertyProcessor";
import { MoneyCalculator } from "./MoneyCalculator";

export class RollProcessor {
  private gameId: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private player?: Player | null;
  private playerPassedPayDay: boolean;

  private forceDie1: number | null;
  private forceDie2: number | null;
  private rollDesc: string;

  private static isolation_position = 11;
  private static payToGetOutFee = 100;

  constructor(
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    forceDie1: number | null,
    forceDie2: number | null
  ) {
    this.gameId = gameId;
    this.userId = userId;
    this.playerPassedPayDay = false;
    this.forceDie1 = forceDie1;
    this.forceDie2 = forceDie2;
    this.rollDesc = "";
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
    this.updatePlayerPosition();

    if (this.playerPassedPayDay === true) {
      MoneyCalculator.collectSalary(this.player);
    }

    if (this.shouldCreateAuction()) {
      const newAuction: AuctionDocument = await AuctionProcessor.createAuction(
        this.game,
        this.player
      );
      this.game.auctionId = new mongoose.Types.ObjectId(newAuction._id);
      this.game.auctionSquareId = newAuction.squareId;
    } else if (this.shouldCreateLotto()) {
      this.game.lottoId = await LottoProcessor.createLotto(
        this.game.id,
        this.player
      );
    }

    const payDesc = MoneyCalculator.payRent(this.game, this.player);
    if (payDesc.length > 0) {
      this.rollDesc += "<br />" + payDesc;
    }

    const lastRoll = this.getLastRoll()!;
    this.game.results = {
      roll: lastRoll,
      description: this.player.name + "<br /> " + this.rollDesc,
    };

    this.game.save();
  }

  private updatePlayerPosition(): void {
    if (!this.player || !this.game) {
      return;
    }
    const lastRoll = this.getLastRoll();
    if (!lastRoll) {
      return;
    }

    let gotOutOfIsolation = false;
    let updatePosition = false;

    if (this.player.state === PlayerState.IN_ISOLATION) {
      if (lastRoll.isDouble() || this.player.numTurnsInIsolation >= 2) {
        this.player.state = PlayerState.ACTIVE;
        this.player.numTurnsInIsolation = 0;
        updatePosition = true;
        gotOutOfIsolation = true;
        this.player.rollHistory = [lastRoll];
        this.rollDesc += lastRoll.isDouble()
          ? " <br /> rolled a double to get out of quarantine"
          : " <br /> left quarantine after 3 turns";
      } else {
        this.player.numTurnsInIsolation += 1;
        this.rollDesc +=
          " <br /> still in quarantine # turns:" +
          this.player.numTurnsInIsolation;
      }
      this.player.hasRolled = true;
    } else if (this.hasRolledThreeConsecutiveDoubles()) {
      this.playerPassedPayDay = false;
      this.player.state = PlayerState.IN_ISOLATION;
      this.player.position = RollProcessor.isolation_position;
      this.player.hasRolled = true;
      this.rollDesc += " <br /> caught speeding and put into quarantine";
      this.player.rollHistory = [lastRoll];
    } else {
      updatePosition = true;
    }

    if (updatePosition) {
      let newPosition = this.player.position + lastRoll.sum();
      if (newPosition > 39) {
        newPosition = newPosition - 39;
        this.playerPassedPayDay = true;
        this.rollDesc += " <br /> Payday, collect your salary!";
      } else {
        this.playerPassedPayDay = false;
      }

      this.player.position = newPosition;

      this.rollDesc +=
        " <br /> landed on " +
        PropertyProcessor.getSquareName(this.game, this.player.position);

      if (!lastRoll.isDouble()) {
        this.player.hasRolled = true;
        this.player.rollHistory = [lastRoll];
      } else if (!gotOutOfIsolation) {
        this.rollDesc += " <br /> rolled a double so go again";
      }
    }
  }

  private updateRollHistory(): void {
    if (!this.player) {
      return;
    }

    const newRoll = new DiceRoll();
    if (this.forceDie1 && this.forceDie2) {
      newRoll.die1 = this.forceDie1;
      newRoll.die2 = this.forceDie2;
    }

    //insert latest roll into the beginning of array
    this.player.rollHistory.unshift(newRoll);

    if (this.player.rollHistory.length > 3) {
      this.player.rollHistory.pop();
    }
  }

  private hasRolledThreeConsecutiveDoubles(): boolean {
    if (!this.player) {
      return false;
    }

    if (this.player.rollHistory.length >= 3) {
      return (
        this.isRollDouble(this.player.rollHistory[0]) &&
        this.isRollDouble(this.player.rollHistory[1]) &&
        this.isRollDouble(this.player.rollHistory[2])
      );
    }

    return false;
  }

  private isRollDouble(roll: DiceRoll): boolean {
    if (!this.player) {
      return false;
    }
    return roll.die1 === roll.die2 ? true : false;
  }

  private getLastRoll(): DiceRoll | null {
    if (!this.player || this.player.rollHistory.length === 0) {
      return null;
    }
    return this.player.rollHistory[0];
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

  private shouldCreateLotto(): boolean {
    if (!this.player || !this.game) {
      return false;
    }

    const squareId: number = this.player.position;
    const squareConfig = SquareConfigDataMap.get(squareId);
    if (!squareConfig) {
      return false;
    }

    return squareConfig.type === SquareType.Lotto;
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

  public async payToGetOut(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (!this.player) {
      return "player not owned";
    }
    if (!this.userId.equals(this.game.nextPlayerToAct)) {
      return "not your turn!";
    }
    if (this.player.hasRolled) {
      return "You already rolled this turn";
    }
    if (this.player.state !== PlayerState.IN_ISOLATION) {
      return "You are not in quarantine";
    }

    if (this.player.money < RollProcessor.payToGetOutFee) {
      return "You don't have enough money to get out of quarantine";
    }

    this.player.numTurnsInIsolation = 0;
    this.player.money = this.player.money - RollProcessor.payToGetOutFee;
    this.player.state = PlayerState.ACTIVE;
    this.player.rollHistory = [];
    await this.game.save();
    return "";
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

    //TODO if negative $, cant roll
    //etc

    return "";
  }
}
