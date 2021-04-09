import { island_position } from "../../core/constants";
import { Player } from "../../core/types/Player";
import { SkillSettings } from "../../core/types/SkillSettings";
import { SquareGameData } from "../../core/types/SquareGameData";

export class Governor {
  public static getPaydaySalary(): number {
    return 200;
  }

  public static getInitialSkills(): SkillSettings {
    return {
      negotiation: 0,
      luck: 0,
      corruption: 2,
      numAbilityPoints: 0,
    };
  }

  public static modifyRentToPay(
    squareData: SquareGameData,
    playerToPay: Player,
    owner: Player,
    rent: number
  ): number {
    const isGovernorsIsland = squareData.squareId === island_position;
    if (isGovernorsIsland) {
      return rent * 2;
    }

    return rent;
  }

  public static modifyTaxAmount(
    squareState: SquareGameData,
    tax: number
  ): number {
    const isGovernorsIsland = squareState.squareId === island_position;
    if (isGovernorsIsland) {
      return 0;
    }

    return tax;
  }

  public static modifyLottoPrizeAmount(prize: number): number {
    return prize;
  }
}
