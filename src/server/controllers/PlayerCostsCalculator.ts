import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
import { Player } from "../../core/types/Player";
import { SquareGameData } from "../../core/types/SquareGameData";
import { areIdsEqual } from "./helpers";
import { conEd_position } from "../../core/constants";
import { Traits } from "../traits/Traits";

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

    player.totalAssets = PlayerCostsCalculator.calculateTotalAssetsForPlayer(
      game,
      player
    );

    player.mortgageableValue = PlayerCostsCalculator.calculateMortgageableValueForPlayer(
      game,
      player
    );

    player.redeemableValue = PlayerCostsCalculator.calculateRedeemableValueForPlayer(
      game,
      player
    );
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
    player: Player
  ): number {
    let total = 0;

    return total;
  }

  private static calculateMortgageableValueForPlayer(
    game: GameInstanceDocument,
    player: Player
  ): number {
    let total = 0;

    return total;
  }

  private static calculateRedeemableValueForPlayer(
    game: GameInstanceDocument,
    player: Player
  ): number {
    let total = 0;

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
