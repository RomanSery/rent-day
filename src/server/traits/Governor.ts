import { defaultStartSkillPoints } from "../../core/constants";
import { SkillSettings } from "../../core/types/SkillSettings";

export class Governor {
  public static getPaydaySalary(): number {
    return 200;
  }

  public static getInitialSkills(): SkillSettings {
    return {
      negotiation: 0,
      luck: 0,
      corruption: 2,
      numAbilityPoints: defaultStartSkillPoints,
    };
  }
}
