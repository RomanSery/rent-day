import { Player } from "@core/types/Player";
import { SquareGameData } from "@core/types/SquareGameData";
import { GameInstanceDocument } from "../model";
import { GameContext } from "../GameContext";
import { areIdsEqual } from "./helpers";
import { PropertyProcessor } from "./PropertyProcessor";

/**
 * Raises cash for a player who cannot pay: sells houses first, then
 * mortgages properties, until `money` reaches `target` or nothing is left.
 * Used by the turn timer for idle players and by computer players.
 */
export class Liquidation {
  public static async raiseCash(
    ctx: GameContext,
    game: GameInstanceDocument,
    player: Player,
    target: number = 0
  ): Promise<void> {
    while (player.money < target) {
      const sold = await Liquidation.sellOneHouse(ctx, game, player);
      if (!sold) {
        break;
      }
    }

    while (player.money < target) {
      const mortgaged = await Liquidation.mortgageOne(ctx, game, player);
      if (!mortgaged) {
        break;
      }
    }
  }

  private static async sellOneHouse(
    ctx: GameContext,
    game: GameInstanceDocument,
    player: Player
  ): Promise<boolean> {
    const withHouses: SquareGameData[] = game.squareState.filter(
      (s: SquareGameData) =>
        s.owner &&
        areIdsEqual(s.owner, player._id) &&
        s.numHouses > 0 &&
        !s.isMortgaged
    );
    // sell from the square with the most houses so the group stays even
    withHouses.sort((a, b) => b.numHouses - a.numHouses);

    for (const s of withHouses) {
      const errMsg = await PropertyProcessor.sellHouse(ctx, game, player, s.squareId, player._id);
      if (!errMsg) {
        return true;
      }
    }
    return false;
  }

  private static async mortgageOne(
    ctx: GameContext,
    game: GameInstanceDocument,
    player: Player
  ): Promise<boolean> {
    const mortgageable: SquareGameData[] = game.squareState.filter(
      (s: SquareGameData) =>
        s.owner &&
        areIdsEqual(s.owner, player._id) &&
        !s.isMortgaged &&
        s.mortgageValue &&
        s.mortgageValue > 0
    );
    // cheapest first: keeps the valuable squares earning as long as possible
    mortgageable.sort((a, b) => (a.mortgageValue ?? 0) - (b.mortgageValue ?? 0));

    for (const s of mortgageable) {
      const errMsg = await PropertyProcessor.mortgageProperty(ctx, game, player, s.squareId, player._id);
      if (!errMsg) {
        return true;
      }
    }
    return false;
  }
}
