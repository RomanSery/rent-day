import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { SkillType } from "../../core/enums/SkillType";
import { Player } from "../../core/types/Player";
import { GameStatus } from "../../core/enums/GameStatus";
import { PlayerState } from "../../core/enums/PlayerState";
import { UserInstance, UserDocument } from "../../core/schema/UserSchema";

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

  public static async getUserGame(
    userId: mongoose.Types.ObjectId
  ): Promise<GameInstanceDocument | null> {
    const foundUser = await UserInstance.findById(
      userId,
      (err: mongoose.CallbackError, existingUser: UserDocument) => {
        if (err) {
          return console.log(err);
        }
        return existingUser;
      }
    );

    if (!foundUser || !foundUser.currGameId) {
      return null;
    }

    return await GameInstance.findById(
      foundUser.currGameId,
      (err: mongoose.CallbackError, existingGame: GameInstanceDocument) => {
        if (err) {
          return console.log(err);
        }
        return existingGame;
      }
    );
  }

  public async upgradeSkill(skillType: SkillType): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (!this.player) {
      return "player not owned";
    }
    if (this.player.state === PlayerState.BANKRUPT) {
      return this.player.name + " is bankrupt";
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

  public static async updateLossesAndLeaveGame(
    game: GameInstanceDocument,
    userId: mongoose.Types.ObjectId
  ): Promise<void> {
    const ud: UserDocument | null = await UserInstance.findById(
      userId,
      (err: mongoose.CallbackError, u: UserDocument) => {
        if (err) {
          return console.log(err);
        }
        return u;
      }
    );
    if (ud) {
      if (game.status === GameStatus.ACTIVE) {
        ud.losses++;
      }
      ud.currGameId = undefined;
      ud.currGameName = undefined;
      await ud.save();
    }
  }

  public static async updateLosses(
    game: GameInstanceDocument,
    userId: mongoose.Types.ObjectId
  ): Promise<void> {
    const ud: UserDocument | null = await UserInstance.findById(
      userId,
      (err: mongoose.CallbackError, u: UserDocument) => {
        if (err) {
          return console.log(err);
        }
        return u;
      }
    );
    if (ud) {
      if (game.status === GameStatus.ACTIVE) {
        ud.losses++;
      }
      await ud.save();
    }
  }

  public static async updateWins(
    game: GameInstanceDocument,
    userId: mongoose.Types.ObjectId
  ): Promise<void> {
    const ud: UserDocument | null = await UserInstance.findById(
      userId,
      (err: mongoose.CallbackError, u: UserDocument) => {
        if (err) {
          return console.log(err);
        }
        return u;
      }
    );
    if (ud) {
      if (game.status === GameStatus.ACTIVE) {
        ud.losses++;
      }
      await ud.save();
    }
  }
}
