import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { SkillType } from "../../core/enums/SkillType";
import { Player } from "../../core/types/Player";

export class PlayerProcessor {
  private gameId: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private player?: Player | null;

  constructor(
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ) {
    this.gameId = gameId;
    this.userId = userId;
  }

  public async init(): Promise<void> {
    this.game = await GameInstance.findById(this.gameId);
    if (this.game) {
      this.player = this.game.players.find(
        (p: Player) =>
          p._id && new mongoose.Types.ObjectId(p._id).equals(this.userId)
      );
    }
  }

  public async upgradeSkill(skillType: SkillType): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (!this.player) {
      return "player not owned";
    }
    if (this.player.numAbilityPoints <= 0) {
      return "You dont have any available points";
    }
    if (!this.userId.equals(this.game.nextPlayerToAct)) {
      return "not your turn!";
    }

    this.player.numAbilityPoints--;
    if (skillType === SkillType.Negotiation) {
      this.player.negotiation++;
    } else if (skillType === SkillType.Luck) {
      this.player.luck++;
    } else if (skillType === SkillType.Corruption) {
      this.player.corruption++;
    }

    await this.game.save();

    return "";
  }
}
