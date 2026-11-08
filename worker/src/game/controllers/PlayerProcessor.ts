import { SkillType } from "@core/enums/SkillType";
import { Player } from "@core/types/Player";
import { GameStatus } from "@core/enums/GameStatus";
import { PlayerState } from "@core/enums/PlayerState";
import { GameInstanceDocument, UserDocument } from "../model";
import { GameContext } from "../GameContext";
import { areIdsEqual } from "./helpers";

export class PlayerProcessor {
  private ctx: GameContext;
  private userId: string;
  private game?: GameInstanceDocument | null;
  private player?: Player | null;

  constructor(ctx: GameContext, userId: string) {
    this.ctx = ctx;
    this.userId = userId;
  }

  public async init(): Promise<void> {
    this.game = await this.ctx.store.getGame();
    if (this.game) {
      this.player = this.game.players.find(
        (p: Player) => p._id && areIdsEqual(p._id, this.userId)
      );
    }
  }

  public static async assignUserToGame(
    ctx: GameContext,
    userId: string,
    game: GameInstanceDocument
  ): Promise<void> {
    const ud: UserDocument | null = await ctx.store.getUser(userId);
    if (ud) {
      ud.gamesPlayed++;
      ud.currGameId = game._id;
      ud.currGameName = game.name;
      await ctx.store.saveUser(ud);
    }
  }

  public static async onJoinGame(
    ctx: GameContext,
    userId: string,
    game: GameInstanceDocument
  ): Promise<void> {
    const ud: UserDocument | null = await ctx.store.getUser(userId);
    if (ud) {
      ud.currGameId = game._id;
      ud.currGameName = game.name;
      await ctx.store.saveUser(ud);
    }
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
    if (!areIdsEqual(this.userId, this.game.nextPlayerToAct)) {
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

    await this.ctx.store.saveGame(this.game);

    return "";
  }

  public static async updateLossesAndLeaveGame(
    ctx: GameContext,
    game: GameInstanceDocument,
    userId: string
  ): Promise<void> {
    const ud: UserDocument | null = await ctx.store.getUser(userId);
    if (ud) {
      if (game.status === GameStatus.ACTIVE) {
        ud.losses++;
      }
      ud.currGameId = undefined;
      ud.currGameName = undefined;
      await ctx.store.saveUser(ud);
    }
  }

  public static async updateLosses(
    ctx: GameContext,
    game: GameInstanceDocument,
    userId: string
  ): Promise<void> {
    const ud: UserDocument | null = await ctx.store.getUser(userId);
    if (ud) {
      if (game.status === GameStatus.ACTIVE) {
        ud.losses++;
      }
      await ctx.store.saveUser(ud);
    }
  }

  public static async updateWins(
    ctx: GameContext,
    userId: string
  ): Promise<void> {
    const ud: UserDocument | null = await ctx.store.getUser(userId);
    if (ud) {
      ud.wins++;
      await ctx.store.saveUser(ud);
    }
  }
}
