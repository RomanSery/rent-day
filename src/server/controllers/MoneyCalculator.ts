import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
import { Player } from "../../core/types/Player";
import { SquareGameData } from "../../core/types/SquareGameData";
import mongoose from "mongoose";

export class MoneyCalculator {
  public static collectSalary(player: Player): void {
    player.money = player.money + 200;
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

    const rentToPay = squareData!.rent0;
    if (!rentToPay || rentToPay <= 0) {
      return "";
    }

    player.money -= rentToPay;
    owner!.money += rentToPay;

    return "Payed " + owner!.name + " $" + rentToPay + " in rent";
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
}
