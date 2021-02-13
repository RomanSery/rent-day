import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
import { Player } from "../../core/types/Player";
import { SquareGameData } from "../../core/types/SquareGameData";
import mongoose from "mongoose";
import {
  areIdsEqual,
  doesOwnAllPropertiesInGroup,
  dollarFormatterServer,
  howManyTrainStationsDoesPlayerOwn,
} from "./helpers";
import { mta_position } from "../../core/constants";
import { Traits } from "../traits/Traits";
import { GameProcessor } from "./GameProcessor";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";

export class MoneyCalculator {
  public static collectSalary(player: Player): void {
    player.money = player.money + Traits.getPaydaySalary(player.playerClass);
  }

  public static subtractElectricityAndTaxes(player: Player): void {
    const total = player.electricityCostsPerTurn + player.taxesPerTurn;
    player.money -= total;
  }

  public static getMortgageValue(purchasePrice: number): number {
    return Math.round(purchasePrice * 0.3);
  }

  public static getRedeemValue(state: SquareGameData): number {
    if (state.mortgageValue) {
      return Math.round(state.mortgageValue + state.mortgageValue * 0.1);
    }
    return 0;
  }

  public static getHouseCost(state: SquareGameData): number {
    if (state.houseCost) {
      return state.houseCost;
    }
    return 0;
  }

  public static getSellPriceForHouse(state: SquareGameData): number {
    if (state.houseCost) {
      return state.houseCost / 2;
    }
    return 0;
  }

  public static payRent(game: GameInstanceDocument, player: Player): string {
    if (!this.shouldPayRent(game, player)) {
      return "";
    }

    const squareId: number = player.position;
    const squareData: SquareGameData | undefined = game.squareState.find(
      (p: SquareGameData) => p.squareId === squareId
    );

    const owner = game.players.find(
      (p) =>
        p._id &&
        new mongoose.Types.ObjectId(p._id).equals(
          new mongoose.Types.ObjectId(squareData!.owner)
        )
    );

    const rentToPay = MoneyCalculator.getRentToPay(
      game,
      squareId,
      owner,
      squareData
    );

    const classAdjustedRentToPay = Traits.modifyRentToPay(
      squareData,
      player,
      owner,
      rentToPay
    );

    const negotiationAdjustment = (player.negotiation * 3) / 100.0;
    const substraction = classAdjustedRentToPay * negotiationAdjustment;
    const adjustedRentToPay = classAdjustedRentToPay - substraction;

    if (adjustedRentToPay <= 0) {
      return "";
    }

    const cantPay = adjustedRentToPay >= player.totalAssets;

    //dont pay more rent than the total assets the player has
    const finalRentToPay =
      adjustedRentToPay > player.totalAssets
        ? player.totalAssets
        : adjustedRentToPay;

    console.log(
      "finalRentToPay: %d adjustedRentToPay: %d totalAssets: %d",
      finalRentToPay,
      adjustedRentToPay,
      player.totalAssets
    );

    player.money -= finalRentToPay;
    owner!.money += finalRentToPay;

    if (cantPay) {
      GameProcessor.bankruptPlayer(
        game,
        new mongoose.Types.ObjectId(player._id)
      );
    }

    PlayerCostsCalculator.updatePlayerCosts(game, player);
    PlayerCostsCalculator.updatePlayerCosts(game, owner!);

    return (
      "Payed " +
      owner!.name +
      " " +
      dollarFormatterServer.format(finalRentToPay) +
      " in rent"
    );
  }

  private static getRentToPay(
    game: GameInstanceDocument,
    squareId: number,
    owner: Player | undefined,
    squareData: SquareGameData | undefined
  ): number {
    const squareConfig = SquareConfigDataMap.get(squareId);
    if (!squareConfig) {
      return 0;
    }
    if (!owner || !squareData) {
      return 0;
    }

    if (squareConfig.type === SquareType.TrainStation) {
      return MoneyCalculator.getTrainStationRent(game, owner, squareData);
    } else if (squareConfig.type === SquareType.Property) {
      return MoneyCalculator.getPropertyRent(game, squareId, owner, squareData);
    }

    return 0;
  }

  private static getTrainStationRent(
    game: GameInstanceDocument,
    owner: Player,
    squareData: SquareGameData
  ): number {
    let rent: number = 0;
    const numOwned = howManyTrainStationsDoesPlayerOwn(game, owner);
    if (numOwned === 1) {
      rent = squareData.rent0!;
    } else if (numOwned === 2) {
      rent = squareData.rent1!;
    } else if (numOwned === 3) {
      rent = squareData.rent2!;
    } else if (numOwned === 4) {
      rent = squareData.rent3!;
    }

    const ownsMta = MoneyCalculator.doesPlayerOwnMTA(game, owner._id);
    if (ownsMta) {
      rent = rent * 2;
    }
    return rent;
  }

  private static getPropertyRent(
    game: GameInstanceDocument,
    squareId: number,
    owner: Player,
    squareData: SquareGameData
  ): number {
    const numHouses = squareData.numHouses;
    if (numHouses === 0 && squareData.rent0) {
      const ownsGroup = doesOwnAllPropertiesInGroup(
        game,
        squareId,
        new mongoose.Types.ObjectId(owner._id)
      );
      if (ownsGroup) {
        return squareData.rent0 * 2;
      }
      return squareData.rent0;
    }

    if (squareData.numHouses === 1) {
      return squareData.rent1!;
    } else if (squareData.numHouses === 2) {
      return squareData.rent2!;
    } else if (squareData.numHouses === 3) {
      return squareData.rent3!;
    } else if (squareData.numHouses === 4) {
      return squareData.rent4!;
    } else if (squareData.numHouses === 5) {
      return squareData.rent5!;
    }

    return 0;
  }

  private static shouldPayRent(
    game: GameInstanceDocument,
    player: Player
  ): boolean {
    const squareId: number = player.position;
    const squareConfig = SquareConfigDataMap.get(squareId);
    if (!squareConfig) {
      return false;
    }
    if (
      squareConfig.type !== SquareType.Property &&
      squareConfig.type !== SquareType.TrainStation
    ) {
      return false;
    }

    const squareData: SquareGameData | undefined = game.squareState.find(
      (p: SquareGameData) => p.squareId === squareId
    );
    if (squareData == null) {
      return false;
    }
    if (squareData.owner == null) {
      return false;
    }
    if (
      new mongoose.Types.ObjectId(squareData.owner).equals(
        new mongoose.Types.ObjectId(player._id)
      )
    ) {
      return false;
    }
    if (squareData.isMortgaged) {
      return false;
    }

    return true;
  }

  private static doesPlayerOwnMTA(
    game: GameInstanceDocument,
    playerId: string
  ): boolean {
    const squareData: SquareGameData | undefined = game.squareState.find(
      (p: SquareGameData) => p.squareId === mta_position
    );
    return squareData &&
      squareData.owner &&
      areIdsEqual(squareData.owner, playerId)
      ? true
      : false;
  }
}
