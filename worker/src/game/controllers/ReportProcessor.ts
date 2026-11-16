// Report a citizen: on your turn, once per turn, spend one Corruption point
// to report another player to the Ministry. With a chance that grows with
// your Corruption (reportSuccessChance) they believe you and the other player
// goes straight to quarantine, where they collect no rent. Otherwise the
// report backfires and you pay the false-report fine, which can take you
// below $0 like any other bill.

import { falseReportFine, isolation_position, reportSuccessChance } from "@core/constants";
import { GameStatus } from "@core/enums/GameStatus";
import { PlayerState } from "@core/enums/PlayerState";
import { GameEvent } from "@core/types/GameEvent";
import { Player } from "@core/types/Player";
import { GameContext } from "../GameContext";
import { GameInstanceDocument } from "../model";
import { randomInt } from "../random";
import { areIdsEqual } from "./helpers";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";

/** a forced outcome, honoured in development only (tests) */
export type ReportOutcome = "believed" | "backfired";

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");

export class ReportProcessor {
  private outcome: ReportOutcome | null = null;

  constructor(
    private readonly ctx: GameContext,
    private readonly userId: string,
    private readonly targetId: string,
    private readonly forceOutcome: ReportOutcome | null = null
  ) {}

  /** why this player can't report that one right now ("" when they can) */
  public static whyNot(game: GameInstanceDocument, reporter: Player | undefined, target: Player | undefined): string {
    if (game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (!reporter) {
      return "player not found";
    }
    if (reporter.state === PlayerState.BANKRUPT) {
      return reporter.name + " is bankrupt";
    }
    if (!areIdsEqual(reporter._id, game.nextPlayerToAct)) {
      return "not your turn!";
    }
    if (game.auctionId || game.lottoId) {
      return "Finish the auction or Vax Lottery first";
    }
    if (reporter.corruption < 1) {
      return "You need at least 1 Corruption point to file a report";
    }
    if (!target || target.state === PlayerState.BANKRUPT) {
      return "That citizen is not in the game";
    }
    if (areIdsEqual(target._id, reporter._id)) {
      return "You can't report yourself";
    }
    if (target.state === PlayerState.IN_ISOLATION) {
      return target.name + " is already in quarantine";
    }
    if (reporter.reportedOnTurn === (game.turnNumber ?? 0)) {
      return "You already filed a report this turn";
    }
    return "";
  }

  public getOutcome(): ReportOutcome | null {
    return this.outcome;
  }

  public async report(): Promise<string> {
    const game = await this.ctx.store.getGame();
    if (!game) {
      return "game not found";
    }
    const reporter = game.players.find((p) => areIdsEqual(p._id, this.userId));
    const target = game.players.find((p) => areIdsEqual(p._id, this.targetId));
    const errMsg = ReportProcessor.whyNot(game, reporter, target);
    if (errMsg || !reporter || !target) {
      return errMsg || "player not found";
    }

    // the chance counts the Corruption spent on the report
    const chance = reportSuccessChance(reporter.corruption);
    const believed =
      this.ctx.isDev && this.forceOutcome
        ? this.forceOutcome === "believed"
        : randomInt(game, 1, 100) <= chance;

    reporter.corruption -= 1;
    reporter.reportedOnTurn = game.turnNumber ?? 0;

    const who = "<b>" + escapeHtml(reporter.name) + "</b>";
    const whom = escapeHtml(target.name);
    let line: string;
    let snack: string;
    if (believed) {
      // straight there, like Big Brother: no trip round the board
      target.state = PlayerState.IN_ISOLATION;
      target.position = isolation_position;
      target.numTurnsInIsolation = 0;
      target.rollHistory = [];
      line = who + " - Reported " + whom + " to the Ministry; " + whom + " was sent to quarantine";
      snack = reporter.name + " reported " + target.name + " to the Ministry. " + target.name + " has been sent to quarantine.";
    } else {
      reporter.money -= falseReportFine;
      line = who + " - Filed a false report against " + whom + " and was fined $" + falseReportFine;
      snack = reporter.name + " filed a false report against " + target.name + " and was fined $" + falseReportFine + ".";
    }
    this.outcome = believed ? "believed" : "backfired";

    PlayerCostsCalculator.updatePlayerCosts(game, reporter);
    PlayerCostsCalculator.updatePlayerCosts(game, target);
    game.log.push({ msg: line, player: "" });
    await this.ctx.store.saveGame(game);

    this.ctx.events.send(GameEvent.SHOW_SNACK_MSG, snack);
    await this.ctx.events.refreshGameState();
    return "";
  }
}
