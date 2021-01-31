import { SquareConfigDataMap } from "../../core/config/SquareData";
import { defaultStartSkillPoints } from "../../core/constants";
import { SquareType } from "../../core/enums/SquareType";
import { Player } from "../../core/types/Player";
import { SkillSettings } from "../../core/types/SkillSettings";
import { SquareGameData } from "../../core/types/SquareGameData";

export class Conductor {
  public static getPaydaySalary(): number {
    return 200;
  }

  public static getInitialSkills(): SkillSettings {
    return {
      negotiation: 2,
      luck: 0,
      corruption: 0,
      numAbilityPoints: defaultStartSkillPoints,
    };
  }

  public static modifyRentToPay(
    squareData: SquareGameData,
    playerToPay: Player,
    owner: Player,
    rent: number
  ): number {
    const squareConfig = SquareConfigDataMap.get(squareData.squareId);
    if (squareConfig && squareConfig.type === SquareType.TrainStation) {
      return rent * 2;
    }

    return rent;
  }

  public static modifyTaxAmount(
    squareState: SquareGameData,
    tax: number
  ): number {
    return tax;
  }

  public static modifyLottoPrizeAmount(prize: number): number {
    return prize;
  }
}
