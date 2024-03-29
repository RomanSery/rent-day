import { Player } from "../../core/types/Player";
import { SkillSettings } from "../../core/types/SkillSettings";
import { SquareGameData } from "../../core/types/SquareGameData";

export class Gambler {
  public static getPaydaySalary(): number {
    return 200;
  }

  public static getInitialSkills(): SkillSettings {
    return {
      negotiation: 0,
      luck: 2,
      corruption: 0,
      numAbilityPoints: 0,
    };
  }

  public static modifyRentToPay(
    squareData: SquareGameData,
    playerToPay: Player,
    owner: Player,
    rent: number
  ): number {
    return rent;
  }

  public static modifyTaxAmount(
    squareState: SquareGameData,
    tax: number
  ): number {
    return tax;
  }

  public static modifyLottoPrizeAmount(prize: number): number {
    const extra = prize * 0.6;
    return prize + extra;
  }
}
