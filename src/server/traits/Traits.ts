import { defaultStartSkillPoints } from "../../core/constants";
import { PlayerClass } from "../../core/enums/PlayerClass";
import { SkillSettings } from "../../core/types/SkillSettings";
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
}
