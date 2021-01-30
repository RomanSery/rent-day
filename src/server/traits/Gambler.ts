import { defaultStartSkillPoints } from "../../core/constants";
import { SkillSettings } from "../../core/types/SkillSettings";

export class Gambler {
  public static getPaydaySalary(): number {
    return 75;
  }

  public static getInitialSkills(): SkillSettings {
    return {
      negotiation: 0,
      luck: 5,
      corruption: 0,
      numAbilityPoints: defaultStartSkillPoints,
    };
  }
}
