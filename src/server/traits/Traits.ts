import { defaultStartSkillPoints } from "../../core/constants";
import { PlayerClass } from "../../core/enums/PlayerClass";
import { Player } from "../../core/types/Player";
import { SkillSettings } from "../../core/types/SkillSettings";
import { SquareGameData } from "../../core/types/SquareGameData";
import { Banker } from "./Banker";
import { Conductor } from "./Conductor";
import { Gambler } from "./Gambler";
import { Governor } from "./Governor";

export class Traits {
  public static getPaydaySalary(type: PlayerClass): number {
    if (type === PlayerClass.Banker) {
      return Banker.getPaydaySalary();
    } else if (type === PlayerClass.Conductor) {
      return Conductor.getPaydaySalary();
    } else if (type === PlayerClass.Gambler) {
      return Gambler.getPaydaySalary();
    } else if (type === PlayerClass.Governor) {
      return Governor.getPaydaySalary();
    }
    return 200;
  }

  public static modifyRentToPay(
    squareData: SquareGameData | undefined,
    playerToPay: Player,
    owner: Player | undefined,
    rent: number
  ): number {
    if (!squareData || !owner) {
      return rent;
    }

    const type: PlayerClass = owner.playerClass;
    if (type === PlayerClass.Banker) {
      return Banker.modifyRentToPay(squareData, playerToPay, owner, rent);
    } else if (type === PlayerClass.Conductor) {
      return Conductor.modifyRentToPay(squareData, playerToPay, owner, rent);
    } else if (type === PlayerClass.Gambler) {
      return Gambler.modifyRentToPay(squareData, playerToPay, owner, rent);
    } else if (type === PlayerClass.Governor) {
      return Governor.modifyRentToPay(squareData, playerToPay, owner, rent);
    }
    return rent;
  }

  public static getInitialSkills(type: PlayerClass): SkillSettings {
    if (type === PlayerClass.Banker) {
      return Banker.getInitialSkills();
    } else if (type === PlayerClass.Conductor) {
      return Conductor.getInitialSkills();
    } else if (type === PlayerClass.Gambler) {
      return Gambler.getInitialSkills();
    } else if (type === PlayerClass.Governor) {
      return Governor.getInitialSkills();
    }

    return {
      negotiation: 0,
      luck: 0,
      corruption: 0,
      numAbilityPoints: defaultStartSkillPoints,
    };
  }

  public static modifyTaxAmount(
    type: PlayerClass,
    squareState: SquareGameData,
    tax: number
  ): number {
    if (type === PlayerClass.Banker) {
      return Banker.modifyTaxAmount(squareState, tax);
    } else if (type === PlayerClass.Conductor) {
      return Conductor.modifyTaxAmount(squareState, tax);
    } else if (type === PlayerClass.Gambler) {
      return Gambler.modifyTaxAmount(squareState, tax);
    } else if (type === PlayerClass.Governor) {
      return Governor.modifyTaxAmount(squareState, tax);
    }

    return tax;
  }

  public static modifyLottoPrizeAmount(
    type: PlayerClass,
    prize: number
  ): number {
    if (type === PlayerClass.Banker) {
      return Banker.modifyLottoPrizeAmount(prize);
    } else if (type === PlayerClass.Conductor) {
      return Conductor.modifymodifyLottoPrizeAmountTaxAmount(prize);
    } else if (type === PlayerClass.Gambler) {
      return Gambler.modifyLottoPrizeAmount(prize);
    } else if (type === PlayerClass.Governor) {
      return Governor.modifyLottoPrizeAmount(prize);
    }

    return prize;
  }
}
