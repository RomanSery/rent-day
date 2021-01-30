import { defaultStartSkillPoints } from "../../core/constants";
import { SkillSettings } from "../../core/types/SkillSettings";

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
}
