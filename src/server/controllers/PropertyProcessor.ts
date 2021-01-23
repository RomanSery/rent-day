import mongoose from "mongoose";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { Bidder } from "../../core/types/Bidder";
import { Player } from "../../core/types/Player";
import { SquareGameData } from "../../core/types/SquareGameData";
import { doesOwnAllPropertiesInGroup } from "./helpers";
import { MoneyCalculator } from "./MoneyCalculator";

export class PropertyProcessor {
  private squareId: number;
  private gameId: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private state: SquareGameData | undefined;
  private player?: Player | null;

  constructor(
    squareId: number,
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ) {
    this.squareId = squareId;
    this.gameId = gameId;
    this.userId = userId;
  }

  public async init(): Promise<void> {
    this.game = await GameInstance.findById(this.gameId);
    if (this.game) {
      this.state = this.game.squareState.find(
        (p: SquareGameData) => p.squareId === this.squareId
      );

      this.player = this.game.players.find(
        (p: Player) =>
          p._id && new mongoose.Types.ObjectId(p._id).equals(this.userId)
      );
    }
  }

  public async mortgageProperty(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (!this.player) {
      return "player not owned";
    }
    if (!this.state) {
      return "property not owned";
    }
    if (this.state.isMortgaged) {
      return "property already mortgaged";
    }

    const ownerId = new mongoose.Types.ObjectId(this.state.owner);
    if (!this.userId.equals(ownerId)) {
      return "you are not the owner";
    }

    this.state.isMortgaged = true;
    if (this.state.mortgageValue) {
      this.player.money = this.player.money + this.state.mortgageValue;
    }

    await this.game.save();

    return "";
  }

  public async redeemProperty(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (!this.player) {
      return "player not owned";
    }
    if (!this.state) {
      return "property not owned";
    }
    if (!this.state.isMortgaged) {
      return "property not mortgaged";
    }

    const ownerId = new mongoose.Types.ObjectId(this.state.owner);
    if (!this.userId.equals(ownerId)) {
      return "you are not the owner";
    }

    const redeemAmount = MoneyCalculator.getRedeemValue(this.state);
    if (this.player.money < redeemAmount) {
      return "You don't have enought money to redeem";
    }

    this.state.isMortgaged = false;
    if (this.state.mortgageValue) {
      this.player.money = this.player.money - redeemAmount;
    }
    await this.game.save();
    return "";
  }

  public purchaseSquare(gameDoc: GameInstanceDocument, winner: Bidder): void {
    const state: SquareGameData | undefined = gameDoc.squareState.find(
      (p: SquareGameData) => p.squareId === this.squareId
    );
    if (state) {
      state.mortgageValue = MoneyCalculator.getMortgageValue(winner.bid!);
      state.purchasePrice = winner.bid!;
      state.color = winner.color!;
      state.owner = winner._id!;
    }
  }

  public async buildHouse(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (!this.player) {
      return "player not owned";
    }
    if (!this.state) {
      return "property not owned";
    }
    if (this.state.isMortgaged) {
      return "property is mortgaged, you have to redeem it before building";
    }

    const ownerId = new mongoose.Types.ObjectId(this.state.owner);
    if (!this.userId.equals(ownerId)) {
      return "you are not the owner";
    }

    if (!doesOwnAllPropertiesInGroup(this.game, this.squareId, this.userId)) {
      return "you cant build, you have to own all properties in the group";
    }

    if (this.state.numHouses >= 5) {
      return "cant build anymore";
    }

    const houseCost = MoneyCalculator.getHouseCost(this.state);
    if (this.player.money < houseCost) {
      return "You don't have enought money to build a house";
    }

    this.state.numHouses += 1;
    if (houseCost) {
      this.player.money -= houseCost;
    }

    await this.game.save();

    return "";
  }

  public async sellHouse(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (!this.player) {
      return "player not owned";
    }
    if (!this.state) {
      return "property not owned";
    }
    if (this.state.isMortgaged) {
      return "property is mortgaged, you have to redeem it before building/selling";
    }

    const ownerId = new mongoose.Types.ObjectId(this.state.owner);
    if (!this.userId.equals(ownerId)) {
      return "you are not the owner";
    }

    if (!doesOwnAllPropertiesInGroup(this.game, this.squareId, this.userId)) {
      return "you cant sell, you have to own all properties in the group";
    }

    if (this.state.numHouses <= 0) {
      return "no houses to sell";
    }

    this.state.numHouses -= 1;
    if (this.state.houseCost) {
      this.player.money += MoneyCalculator.getSellPriceForHouse(this.state);
    }

    await this.game.save();

    return "";
  }

  public static getSquareName(
    gameDoc: GameInstanceDocument,
    squareId: number
  ): string {
    const squareConfig = SquareConfigDataMap.get(squareId);

    if (squareConfig && squareConfig.type === SquareType.Chance) {
      return "Chance";
    } else if (squareConfig && squareConfig.type === SquareType.Isolation) {
      return "Visiting Quarantine";
    } else if (squareConfig && squareConfig.type === SquareType.Lotto) {
      return "Lotto";
    } else {
      const squareTheme = gameDoc.theme.get(squareId.toString());
      return squareTheme ? squareTheme.name : "";
    }
  }
}
