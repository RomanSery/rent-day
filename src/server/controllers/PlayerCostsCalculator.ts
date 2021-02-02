import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
import { Player } from "../../core/types/Player";
import { SquareGameData } from "../../core/types/SquareGameData";
import { areIdsEqual } from "./helpers";
import { conEd_position } from "../../core/constants";
import { Traits } from "../traits/Traits";
import { MoneyCalculator } from "./MoneyCalculator";

export class PlayerCostsCalculator {
  public static updatePlayerCosts(
    game: GameInstanceDocument,
    player: Player
  ): void {
    player.electricityCostsPerTurn = PlayerCostsCalculator.calculateElectrictyCostsForPlayer(
      game,
      player
    );

    player.taxesPerTurn = PlayerCostsCalculator.calculateTaxCostsForPlayer(
      game,
      player
    );

    const mortgageableValue = PlayerCostsCalculator.calculateMortgageableValueForPlayer(
      game,
      player
    );
    const redeemableValue = PlayerCostsCalculator.calculateRedeemableValueForPlayer(
      game,
      player
    );
    const totalAssets = PlayerCostsCalculator.calculateTotalAssetsForPlayer(
      game,
      player,
      mortgageableValue
    );

    player.mortgageableValue = mortgageableValue;
    player.redeemableValue = redeemableValue;
    player.totalAssets = totalAssets;
  }

  private static calculateElectrictyCostsForPlayer(
    game: GameInstanceDocument,
    player: Player
  ): number {
    if (PlayerCostsCalculator.doesPlayerOwnConEd(game, player._id)) {
      return 0;
    }

    const playerOwnedSquaresWithHouses: SquareGameData[] = game.squareState.filter(
      (s: SquareGameData) => {
        return (
          s.owner &&
          areIdsEqual(s.owner, player._id) &&
          s.numHouses > 0 &&
          !s.isMortgaged
        );
      }
    );

    let total = 0;

    playerOwnedSquaresWithHouses.forEach((squareState: SquareGameData) => {
      const cost =
        squareState.numHouses * game.settings.electricityCostPerHouse;
      total += cost;
    });
    return total;
  }

  private static calculateTaxCostsForPlayer(
    game: GameInstanceDocument,
    player: Player
  ): number {
    const playerOwnedSquares: SquareGameData[] = game.squareState.filter(
      (s: SquareGameData) => {
        return (
          s.owner &&
          areIdsEqual(s.owner, player._id) &&
          !s.isMortgaged &&
          s.tax &&
          s.tax > 0 &&
          s.purchasePrice &&
          s.purchasePrice > 0
        );
      }
    );

    let total = 0;

    playerOwnedSquares.forEach((squareState: SquareGameData) => {
      if (squareState.purchasePrice && squareState.tax) {
        const taxRate = squareState.tax / 100.0;
        const tax = squareState.purchasePrice * taxRate;
        const adjustedTax = Traits.modifyTaxAmount(
          player.playerClass,
          squareState,
          tax
        );

        total += adjustedTax;
      }
    });

    const corruptionAdjustment = (player.corruption * 3) / 100.0;
    const substraction = total * corruptionAdjustment;
    const finalTotal = total - substraction;

    return finalTotal;
  }

  private static calculateTotalAssetsForPlayer(
    game: GameInstanceDocument,
    player: Player,
    mortgageableValue: number
  ): number {
    const money = player.money;
    const housesValue = PlayerCostsCalculator.calculateTotalSaleValueOfHouses(
      game,
      player
    );

    return money + mortgageableValue + housesValue;
  }

  private static calculateMortgageableValueForPlayer(
    game: GameInstanceDocument,
    player: Player
  ): number {
    const playerOwnedSquares: SquareGameData[] = game.squareState.filter(
      (s: SquareGameData) => {
        return (
          s.owner &&
          areIdsEqual(s.owner, player._id) &&
          !s.isMortgaged &&
          s.mortgageValue
        );
      }
    );

    let total = 0;
    playerOwnedSquares.forEach((squareState: SquareGameData) => {
      total += squareState.mortgageValue!;
    });
    return total;
  }

  private static calculateRedeemableValueForPlayer(
    game: GameInstanceDocument,
    player: Player
  ): number {
    const playerOwnedSquares: SquareGameData[] = game.squareState.filter(
      (s: SquareGameData) => {
        return (
          s.owner &&
          areIdsEqual(s.owner, player._id) &&
          s.isMortgaged &&
          s.mortgageValue
        );
      }
    );

    let total = 0;
    playerOwnedSquares.forEach((s: SquareGameData) => {
      const redeemAmount = MoneyCalculator.getRedeemValue(s);
      total += redeemAmount;
    });
    return total;
  }

  private static calculateTotalSaleValueOfHouses(
    game: GameInstanceDocument,
    player: Player
  ): number {
    const playerOwnedSquaresWithHouses: SquareGameData[] = game.squareState.filter(
      (s: SquareGameData) => {
        return (
          s.owner &&
          areIdsEqual(s.owner, player._id) &&
          s.numHouses > 0 &&
          !s.isMortgaged
        );
      }
    );

    let total = 0;

    playerOwnedSquaresWithHouses.forEach((s: SquareGameData) => {
      const housesValue = s.numHouses * MoneyCalculator.getSellPriceForHouse(s);
      total += housesValue;
    });
    return total;
  }

  private static doesPlayerOwnConEd(
    game: GameInstanceDocument,
    playerId: string
  ): boolean {
    const squareData: SquareGameData | undefined = game.squareState.find(
      (p: SquareGameData) => p.squareId === conEd_position
    );
    return squareData &&
      squareData.owner &&
      areIdsEqual(squareData.owner, playerId)
      ? true
      : false;
  }
}
