import mongoose from "mongoose";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { GameStatus } from "../../core/enums/GameStatus";
import { PlayerState } from "../../core/enums/PlayerState";
import { SquareType } from "../../core/enums/SquareType";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { Bidder } from "../../core/types/Bidder";
import { Player } from "../../core/types/Player";
import { SquareGameData } from "../../core/types/SquareGameData";
import {
  doesOwnAllPropertiesInGroup,
  areHousesEven,
  doesGroupHaveAnyHouses,
} from "./helpers";
import { MoneyCalculator } from "./MoneyCalculator";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";

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
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (!this.player) {
      return "player not owned";
    }
    if (this.player.state === PlayerState.BANKRUPT) {
      return this.player.name + " is bankrupt";
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

    const squareConfig = SquareConfigDataMap.get(this.squareId);

    if (
      squareConfig &&
      squareConfig.type !== SquareType.Property &&
      squareConfig.type !== SquareType.TrainStation
    ) {
      return "You can't mortgage this type of property";
    }

    if (doesGroupHaveAnyHouses(this.game, squareConfig!.groupId!)) {
      return "You have to sell all the houses in the group first";
    }

    this.state.isMortgaged = true;
    if (this.state.mortgageValue) {
      this.player.money = Math.round(
        this.player.money + this.state.mortgageValue
      );
    }

    PlayerCostsCalculator.updatePlayerCosts(this.game, this.player);

    await this.game.save();

    return "";
  }

  public async redeemProperty(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (!this.player) {
      return "player not owned";
    }
    if (this.player.state === PlayerState.BANKRUPT) {
      return this.player.name + " is bankrupt";
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

    const squareConfig = SquareConfigDataMap.get(this.squareId);

    if (
      squareConfig &&
      squareConfig.type !== SquareType.Property &&
      squareConfig.type !== SquareType.TrainStation
    ) {
      return "You can't redeem this type of property";
    }

    this.state.isMortgaged = false;
    if (this.state.mortgageValue) {
      this.player.money = Math.round(this.player.money - redeemAmount);
    }

    PlayerCostsCalculator.updatePlayerCosts(this.game, this.player);

    await this.game.save();
    return "";
  }

  public purchaseSquare(
    gameDoc: GameInstanceDocument,
    winner: Bidder,
    priceToPay: number
  ): void {
    const state: SquareGameData | undefined = gameDoc.squareState.find(
      (p: SquareGameData) => p.squareId === this.squareId
    );
    if (state) {
      state.mortgageValue = MoneyCalculator.getMortgageValue(priceToPay);
      state.purchasePrice = priceToPay;
      state.color = winner.color!;
      state.owner = winner._id!;
    }
  }

  public async buildHouse(): Promise<string> {
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

    if (!areHousesEven(this.game, this.squareId, true)) {
      return "you must build evenly";
    }

    this.state.numHouses += 1;
    if (houseCost) {
      this.player.money -= houseCost;
    }

    PlayerCostsCalculator.updatePlayerCosts(this.game, this.player);

    await this.game.save();

    return "";
  }

  public async sellHouse(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (!this.player) {
      return "player not owned";
    }
    if (this.player.state === PlayerState.BANKRUPT) {
      return this.player.name + " is bankrupt";
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

    if (!areHousesEven(this.game, this.squareId, false)) {
      return "You must sell evenly";
    }

    this.state.numHouses -= 1;
    if (this.state.houseCost) {
      this.player.money += MoneyCalculator.getSellPriceForHouse(this.state);
    }

    PlayerCostsCalculator.updatePlayerCosts(this.game, this.player);

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
