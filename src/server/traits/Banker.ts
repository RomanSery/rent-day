import { defaultStartSkillPoints } from "../../core/constants";
import { SkillSettings } from "../../core/types/SkillSettings";

export class Banker {
  public static getPaydaySalary(): number {
    return 300;
  }

  public static getInitialSkills(): SkillSettings {
    return {
      negotiation: 0,
      luck: 0,
      corruption: 0,
      numAbilityPoints: defaultStartSkillPoints,
    };
  }
}
