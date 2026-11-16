// Actions that use up a skill point, on your own turn:
//
//   Forged vaccine card (1 Luck): carried until used; the next time you would
//     go to quarantine (Big Brother, three doubles, a believed report) you
//     don't, and it gets you through the vaccine passport check for free.
//     RollProcessor, ChanceProcessor and ReportProcessor use it up.
//   Hardship plea (1 Negotiation): rent you pay for the rest of this turn is
//     halved (MoneyCalculator.payRent). Before your roll, or between doubles.
//   Bribe the guard (1 Corruption): leave quarantine now for free, instead of
//     paying payToGetOutFee. Before you roll, like paying.
//
// Report a citizen (ReportProcessor) is the fourth, and the only one aimed at
// another player.

import { GameStatus } from "@core/enums/GameStatus";
import { PlayerState } from "@core/enums/PlayerState";
import { Player } from "@core/types/Player";
import { GameContext } from "../GameContext";
import { GameInstanceDocument } from "../model";
import { areIdsEqual } from "./helpers";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";

export type SkillAction = "forgeCard" | "hardshipPlea" | "bribeGuard";

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");

/** the log line for a player doing something: "<b>Dana</b> - what" */
const logLine = (game: GameInstanceDocument, player: Player, what: string): void => {
  game.log.push({ msg: "<b>" + escapeHtml(player.name) + "</b> - " + what, player: "" });
};

export class SkillActionProcessor {
  constructor(private readonly ctx: GameContext, private readonly userId: string) {}

  /** why this player can't take this action right now ("" when they can) */
  public static whyNot(game: GameInstanceDocument, player: Player | undefined, action: SkillAction): string {
    if (game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (!player) {
      return "player not found";
    }
    if (player.state === PlayerState.BANKRUPT) {
      return player.name + " is bankrupt";
    }
    if (!areIdsEqual(player._id, game.nextPlayerToAct)) {
      return "not your turn!";
    }
    if (game.auctionId || game.lottoId) {
      return "Finish the auction or Vax Lottery first";
    }

    if (action === "forgeCard") {
      if (player.luck < 1) {
        return "You need at least 1 Luck point to forge a vaccine card";
      }
      if (player.hasForgedCard) {
        return "You already carry a forged vaccine card";
      }
    } else if (action === "hardshipPlea") {
      if (player.negotiation < 1) {
        return "You need at least 1 Negotiation point to plead hardship";
      }
      if (player.hasRolled) {
        return "Plead hardship before you roll";
      }
      if (player.hardshipTurn === (game.turnNumber ?? 0)) {
        return "You already pleaded hardship this turn";
      }
    } else if (action === "bribeGuard") {
      if (player.corruption < 1) {
        return "You need at least 1 Corruption point to bribe the guard";
      }
      if (player.state !== PlayerState.IN_ISOLATION) {
        return "You are not in quarantine";
      }
      if (player.hasRolled) {
        return "You already rolled this turn";
      }
    }
    return "";
  }

  public async run(action: SkillAction): Promise<string> {
    const game = await this.ctx.store.getGame();
    if (!game) {
      return "game not found";
    }
    const player = game.players.find((p) => areIdsEqual(p._id, this.userId));
    const errMsg = SkillActionProcessor.whyNot(game, player, action);
    if (errMsg || !player) {
      return errMsg || "player not found";
    }

    if (action === "forgeCard") {
      player.luck -= 1;
      player.hasForgedCard = true;
      logLine(game, player, "Got hold of a forged vaccine card");
    } else if (action === "hardshipPlea") {
      player.negotiation -= 1;
      player.hardshipTurn = game.turnNumber ?? 0;
      logLine(game, player, "Pleaded hardship: rent is halved for the rest of the turn");
    } else {
      player.corruption -= 1;
      player.state = PlayerState.ACTIVE;
      player.numTurnsInIsolation = 0;
      player.rollHistory = [];
      logLine(game, player, "Bribed the guard and left quarantine");
    }

    PlayerCostsCalculator.updatePlayerCosts(game, player);
    await this.ctx.store.saveGame(game);
    await this.ctx.events.refreshGameState();
    return "";
  }
}
