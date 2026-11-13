// Computer players. A bot is an ordinary entry in game.players flagged with
import { emptyPlayerStats } from "@core/types/PlayerStats";
// isBot; the Durable Object schedules the calls in this file through its
// alarm so bots act on their own, with a pacing delay humans can follow.

import { BotLevel } from "@core/enums/BotLevel";
import { GameStatus } from "@core/enums/GameStatus";
import { PieceType } from "@core/enums/PieceType";
import { PlayerClass } from "@core/enums/PlayerClass";
import { PlayerState } from "@core/enums/PlayerState";
import { GameEvent } from "@core/types/GameEvent";
import { Player } from "@core/types/Player";
import { differenceInMinutes, parseISO } from "date-fns";
import { GameInstanceDocument } from "../model";
import { GameContext } from "../GameContext";
import { newId } from "../ids";
import { randomPick } from "../random";
import { Traits } from "../traits/Traits";
import { AuctionProcessor } from "../controllers/AuctionProcessor";
import { GameProcessor } from "../controllers/GameProcessor";
import { Liquidation } from "../controllers/Liquidation";
import { LottoProcessor } from "../controllers/LottoProcessor";
import { PlayerProcessor } from "../controllers/PlayerProcessor";
import { PropertyProcessor } from "../controllers/PropertyProcessor";
import { RollProcessor } from "../controllers/RollProcessor";
import { TradeProcessor } from "../controllers/TradeProcessor";
import { areIdsEqual } from "../controllers/helpers";
import {
  acceptsTrade,
  bidFor,
  buildPlan,
  lottoChoice,
  shouldPayOut,
  skillChoice,
  tradeProposal,
  travelChoice,
} from "./BotBrain";

export const BOT_NAMES = [
  "Robo Whiskers",
  "Sir Pounce",
  "Mittens 2.0",
  "Captain Tabby",
  "Duchess Fluff",
  "Bot Boots",
];

/** What the Durable Object should do after a bot step. */
export type BotStepResult =
  /** dice thrown or a subway ride taken: wait for the piece to land, then continue */
  | { kind: "rolled"; frames: number[] }
  | "acted"
  | "idle";

export const isBotId = (game: GameInstanceDocument, id: string | null | undefined): boolean =>
  !!game.players.find((p) => areIdsEqual(p._id, id))?.isBot;

export const createBotPlayer = (game: GameInstanceDocument, level: BotLevel): Player => {
  const takenPieces = new Set(game.players.map((p) => p.type));
  const piece = Object.values(PieceType).find((t) => !takenPieces.has(t)) ?? PieceType.Pawn;

  const takenNames = new Set(game.players.map((p) => p.name));
  const name =
    BOT_NAMES.find((n) => !takenNames.has(n)) ?? `Bot ${game.players.length + 1}`;

  const classes = Object.values(PlayerClass);
  const playerClass = randomPick(game, classes) ?? classes[0];
  const skills = Traits.getInitialSkills(playerClass);

  return {
    _id: newId(),
    name,
    isBot: true,
    botLevel: level,
    position: 1,
    money: 0,
    totalAssets: 0,
    mortgageableValue: 0,
    redeemableValue: 0,
    taxesPerTurn: 0,
    electricityCostsPerTurn: 0,
    taxTooltip: "",
    electricityTooltip: "",
    color: "#f58a42",
    type: piece,
    playerClass,
    state: PlayerState.ACTIVE,
    numAbilityPoints: 0,
    negotiation: skills.negotiation,
    luck: skills.luck,
    corruption: skills.corruption,
    hasRolled: false,
    hasTraveled: false,
    canTravel: false,
    rollHistory: [],
    numTurnsInIsolation: 0,
    numTimeouts: 0,
    stats: emptyPlayerStats(),
  };
};

export class BotPlayer {
  /**
   * One step of the bot's turn. Returns "rolled" with the movement path when
   * the piece moves (the caller waits for the dice and the move to play out
   * before the next step), "acted" when
   * something else happened and the bot should continue shortly, and "idle"
   * when there is nothing to do right now.
   */
  public static async step(ctx: GameContext, botId: string): Promise<BotStepResult> {
    let game = await ctx.store.getGame();
    if (!game || game.status !== GameStatus.ACTIVE) {
      return "idle";
    }
    let bot = BotPlayer.find(game, botId);
    if (!bot || !bot.isBot || bot.state === PlayerState.BANKRUPT) {
      return "idle";
    }
    if (!areIdsEqual(game.nextPlayerToAct, botId)) {
      return "idle";
    }
    if (game.auctionId) {
      // bids are placed by placeBids(); the turn resumes once it closes
      return "idle";
    }

    if (game.lottoId) {
      const lotto = await ctx.store.getLotto(game.lottoId);
      if (lotto && areIdsEqual(lotto.playerId, botId) && lotto.prize == null) {
        const errMsg = await new LottoProcessor(ctx, lottoChoice(lotto, bot), botId).pickOption();
        if (errMsg) {
          console.log("bot lotto failed", errMsg);
        }
        const after = await ctx.store.getLotto(game.lottoId);
        ctx.events.broadcast(GameEvent.LOTTO_UPDATE, after);
        await ctx.events.refreshGameState();
        return "acted";
      }
    }

    if (!bot.hasRolled) {
      // 1. get out of debt
      if (bot.money < 0) {
        await Liquidation.raiseCash(ctx, game, bot, 0);
        game = (await ctx.store.getGame())!;
        bot = BotPlayer.find(game, botId)!;
        if (bot.money < 0) {
          await GameProcessor.bankruptPlayer(ctx, game, botId);
          await ctx.store.saveGame(game);
          await ctx.events.refreshGameState();
          return "idle";
        }
      }

      // 2. spend skill points
      let guard = 0;
      while (bot.numAbilityPoints > 0 && guard++ < 10) {
        const errMsg = await new PlayerProcessor(ctx, botId).upgradeSkill(skillChoice(game, bot));
        if (errMsg) {
          break;
        }
        game = (await ctx.store.getGame())!;
        bot = BotPlayer.find(game, botId)!;
      }

      // 3. leave quarantine when rich enough
      if (bot.state === PlayerState.IN_ISOLATION && shouldPayOut(game, bot)) {
        await new RollProcessor(ctx, botId, null, null).payToGetOut();
        game = (await ctx.store.getGame())!;
        bot = BotPlayer.find(game, botId)!;
      }

      // 3b. offer to buy the square that completes a group (rate limited)
      const proposal = tradeProposal(game, bot);
      const turn = game.turnNumber ?? 0;
      if (proposal && turn - (bot.botLastOfferTurn ?? -100) >= 5) {
        const tp = new TradeProcessor(ctx, botId, proposal.toPlayerId, [], [proposal.squareId], proposal.amount, 0);
        const errMsg = await tp.offerTrade();
        const tradeId = tp.getNewTradeId();
        if (!errMsg && tradeId) {
          game = (await ctx.store.getGame())!;
          bot = BotPlayer.find(game, botId)!;
          bot.botLastOfferTurn = turn;
          await ctx.store.saveGame(game);
          const trade = await ctx.store.getTrade(tradeId);
          ctx.events.broadcast(GameEvent.SEND_TRADE_OFFER, trade);
          await ctx.events.onTradeOffered(tradeId);
        }
      }

      // 4. build houses
      for (const squareId of buildPlan(game, bot)) {
        const errMsg = await new PropertyProcessor(ctx, squareId, botId).buildHouse();
        if (errMsg) {
          break;
        }
        game = (await ctx.store.getGame())!;
        bot = BotPlayer.find(game, botId)!;
      }

      // 4b. take the subway away from an expensive stretch of board
      const destination = travelChoice(game, bot);
      if (destination) {
        const trip = new RollProcessor(ctx, botId, null, null);
        const errMsg = await trip.travel(destination);
        if (!errMsg) {
          const tripFrames = trip.getMovementKeyFrames();
          ctx.events.broadcast(GameEvent.STOP_ANIMATE_DICE, botId, null, tripFrames);
          return { kind: "rolled", frames: tripFrames }; // let the piece animate; the roll follows next step
        }
      }

      // 5. roll
      const roll = new RollProcessor(ctx, botId, null, null);
      const errMsg = await roll.roll(false, false);
      if (errMsg) {
        console.log("bot roll failed", errMsg);
        return "idle";
      }
      const dice = roll.getLastDiceRoll();
      const frames = roll.getMovementKeyFrames();
      ctx.events.broadcast(GameEvent.ANIMATE_DICE);
      // the dice spin for one pace, about as long as a human roll
      await ctx.events.broadcastDelayed(ctx.botPaceMs, GameEvent.STOP_ANIMATE_DICE, [
        botId,
        { die1: dice.die1, die2: dice.die2 },
        frames,
      ]);
      return { kind: "rolled", frames };
    }

    // already rolled: settle any debt from rent, then finish the turn
    if (bot.money < 0) {
      await Liquidation.raiseCash(ctx, game, bot, 0);
      game = (await ctx.store.getGame())!;
      bot = BotPlayer.find(game, botId)!;
      if (bot.money < 0) {
        await GameProcessor.bankruptPlayer(ctx, game, botId);
        await ctx.store.saveGame(game);
        await ctx.events.refreshGameState();
        return "idle";
      }
    }
    const errMsg = await new RollProcessor(ctx, botId, null, null).completeMyTurn(false, false);
    if (errMsg) {
      console.log("bot completeTurn failed", errMsg);
      return "idle";
    }
    await ctx.events.refreshGameState();
    // the turn has moved on: nothing more for this bot to do (scheduling another
    // step here used to land in the same alarm batch as the next bot's first
    // step and end that bot's turn mid-move)
    return "idle";
  }

  /** Every bot that still owes a bid in the open auction places one. */
  public static async placeBids(ctx: GameContext): Promise<boolean> {
    const game = await ctx.store.getGame();
    if (!game || !game.auctionId) {
      return false;
    }
    const auction = await ctx.store.getAuction(game.auctionId);
    if (!auction || auction.finished) {
      return false;
    }

    // decide every bid first: the amounts draw on the game's random
    // generator, which must be saved before the bids reload the game
    const bids: Array<{ bot: Player; amount: number }> = [];
    for (const bidder of auction.bidders) {
      if (bidder.submittedBid) {
        continue;
      }
      const bot = BotPlayer.find(game, bidder._id);
      if (!bot || !bot.isBot) {
        continue;
      }
      bids.push({ bot, amount: bidFor(game, auction, bot) });
    }
    if (bids.length) {
      await ctx.store.saveGame(game);
    }

    let placed = false;
    for (const { bot, amount } of bids) {
      const errMsg = await new AuctionProcessor(ctx, amount, bot._id).placeBid();
      if (errMsg) {
        console.log("bot bid failed", errMsg);
      } else {
        placed = true;
      }
    }
    return placed;
  }

  /** Accept or decline a trade offered to a bot. */
  public static async answerTrade(ctx: GameContext, tradeId: string): Promise<void> {
    const game = await ctx.store.getGame();
    const trade = await ctx.store.getTrade(tradeId);
    if (!game || !trade || trade.status !== "Offered") {
      return;
    }
    const bot = BotPlayer.find(game, trade.participant2.playerId);
    if (!bot || !bot.isBot) {
      return;
    }

    const accept = acceptsTrade(game, bot, trade);
    const errMsg = accept
      ? await TradeProcessor.acceptTrade(ctx, bot._id, tradeId, game._id)
      : await TradeProcessor.declineTrade(ctx, bot._id, tradeId, game._id);
    if (errMsg) {
      console.log("bot trade answer failed", errMsg);
      return;
    }
    const after = await ctx.store.getTrade(tradeId);
    ctx.events.broadcast(GameEvent.TRADE_OFFER_REVIEWED, after);
    await ctx.events.refreshGameState();
  }

  /**
   * No human is left in the game: rank the remaining bots by assets and end
   * the game instead of letting them play each other forever.
   */
  public static async finishWithoutHumans(ctx: GameContext, game: GameInstanceDocument): Promise<void> {
    const remaining = game.players
      .filter((p) => p.state !== PlayerState.BANKRUPT)
      .sort((a, b) => b.totalAssets - a.totalAssets);

    const taken = new Set(game.players.map((p) => p.finishedRank).filter((r): r is number => !!r));
    let rank = 1;
    for (const p of remaining) {
      while (taken.has(rank)) {
        rank++;
      }
      p.finishedRank = rank;
      taken.add(rank);
    }

    game.status = GameStatus.FINISHED;
    game.winner = remaining[0]?.name ?? null;
    game.gameLength = differenceInMinutes(new Date(), parseISO(game.createdAt));
    game.log.push({ msg: "All players have left; the game is over.", player: "" });
    await ctx.store.saveGame(game);
  }

  private static find(game: GameInstanceDocument, id: string | null | undefined): Player | undefined {
    return game.players.find((p) => areIdsEqual(p._id, id));
  }
}
