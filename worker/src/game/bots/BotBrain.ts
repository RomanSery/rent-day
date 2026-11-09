// Decision rules for computer players. Everything here is a pure function
// of the game state so it can be unit-tested and tuned without touching the
// turn machinery in BotPlayer.

import { SquareConfigDataMap } from "@core/config/SquareData";
import { SquareType } from "@core/enums/SquareType";
import { BotLevel } from "@core/enums/BotLevel";
import { PlayerClass } from "@core/enums/PlayerClass";
import { SkillType } from "@core/enums/SkillType";
import { Player } from "@core/types/Player";
import { SquareGameData } from "@core/types/SquareGameData";
import { conEd_position, mta_position, payToGetOutFee } from "@core/constants";
import { AuctionDocument, GameInstanceDocument, LottoDocument, TradeDocument } from "../model";
import { areIdsEqual, areHousesEven, doesGroupHaveMortgagedProperty } from "../controllers/helpers";

const level = (bot: Player): BotLevel => bot.botLevel ?? BotLevel.Normal;

const squareState = (game: GameInstanceDocument, squareId: number): SquareGameData | undefined =>
  game.squareState.find((s) => s.squareId === squareId);

const squaresInGroup = (groupId: number): number[] => {
  const ids: number[] = [];
  SquareConfigDataMap.forEach((d, key) => {
    if (d.groupId === groupId) {
      ids.push(key);
    }
  });
  return ids;
};

const stationsOwnedBy = (game: GameInstanceDocument, playerId: string): number => {
  let n = 0;
  SquareConfigDataMap.forEach((d, key) => {
    if (d.type === SquareType.TrainStation) {
      const s = squareState(game, key);
      if (s && s.owner && areIdsEqual(s.owner, playerId)) {
        n++;
      }
    }
  });
  return n;
};

/** Cash the bot wants to keep on hand for taxes, electricity and rent. */
export const reserveFor = (game: GameInstanceDocument, bot: Player): number => {
  const perTurn = bot.taxesPerTurn + bot.electricityCostsPerTurn;
  const base = level(bot) === BotLevel.Easy ? 250 : 150;
  return base + perTurn * 3;
};

/** What a square is worth to this bot, in dollars. */
export const valueOf = (game: GameInstanceDocument, bot: Player, squareId: number): number => {
  const config = SquareConfigDataMap.get(squareId);
  if (!config) {
    return 0;
  }
  const state = squareState(game, squareId);
  let value = 0;

  if (config.type === SquareType.Property) {
    const rent0 = state?.rent0 ?? config.rent?.get(0) ?? 0;
    value = rent0 * 10 + (config.houseCost ?? 0) * 0.5;

    if (config.groupId) {
      const group = squaresInGroup(config.groupId).filter((id) => id !== squareId);
      const mine = group.filter((id) => areIdsEqual(squareState(game, id)?.owner, bot._id)).length;
      const theirs = group.filter((id) => {
        const owner = squareState(game, id)?.owner;
        return owner && !areIdsEqual(owner, bot._id);
      }).length;

      if (theirs > 0) {
        value *= 0.6; // someone else is blocking the group
      } else if (mine === group.length) {
        value *= 2.2; // completes the group
      } else if (mine > 0) {
        value *= 1.4;
      }
    }
  } else if (config.type === SquareType.TrainStation) {
    value = 200 + 60 * stationsOwnedBy(game, bot._id);
  } else if (config.type === SquareType.Utility) {
    if (squareId === mta_position) {
      value = 120 + 40 * stationsOwnedBy(game, bot._id);
    } else if (squareId === conEd_position) {
      value = 140 + 20 * bot.electricityCostsPerTurn;
    } else {
      value = 100;
    }
  }

  if (level(bot) === BotLevel.Easy) {
    value *= 0.6;
  }
  return Math.round(value);
};

const jitter = (amount: number, spread: number): number =>
  amount * (1 - spread + Math.random() * spread * 2);

/** The silent bid for the square under auction (second-price, so bid value). */
export const bidFor = (game: GameInstanceDocument, auction: AuctionDocument, bot: Player): number => {
  if (bot.state === "In_Isolation") {
    return 0;
  }
  const value = valueOf(game, bot, auction.squareId);
  const cap =
    level(bot) === BotLevel.Easy
      ? Math.floor(bot.money * 0.3)
      : bot.money - reserveFor(game, bot);
  const amount = Math.round(jitter(Math.min(value, cap), 0.1));
  if (amount < 5) {
    return 0;
  }
  return Math.max(0, Math.min(amount, bot.money));
};

/** Which lotto option to take. */
export const lottoChoice = (lotto: LottoDocument, bot: Player): number => {
  if (level(bot) === BotLevel.Easy) {
    return 1;
  }
  const options = [
    { opt: 1, ev: lotto.option1Amount * lotto.option1Percent },
    { opt: 2, ev: lotto.option2Amount * lotto.option2Percent },
    { opt: 3, ev: lotto.option3Amount * lotto.option3Percent },
  ];
  options.sort((a, b) => b.ev - a.ev);
  return options[0].opt;
};

/** Should the bot accept a trade offered to it? */
export const acceptsTrade = (game: GameInstanceDocument, bot: Player, trade: TradeDocument): boolean => {
  const offered = trade.participant1; // what the other player gives
  const asked = trade.participant2; // what the bot gives

  if (asked.amountGiven > bot.money - reserveFor(game, bot)) {
    return false;
  }

  const received =
    offered.amountGiven +
    offered.squaresGiven.reduce((sum, id) => sum + valueOf(game, bot, id), 0);
  const given =
    asked.amountGiven +
    asked.squaresGiven.reduce((sum, id) => sum + valueOf(game, bot, id), 0);

  const margin = level(bot) === BotLevel.Easy ? 1.3 : 1.1;
  return received >= given * margin && received > 0;
};

/** Squares to build a house on this turn, in order. */
export const buildPlan = (game: GameInstanceDocument, bot: Player): number[] => {
  if (level(bot) === BotLevel.Easy) {
    return [];
  }
  const plan: number[] = [];
  let budget = bot.money - reserveFor(game, bot);
  // work on a copy of house counts so the plan stays even
  const houses = new Map<number, number>();
  game.squareState.forEach((s) => houses.set(s.squareId, s.numHouses));

  const groups = new Set<number>();
  SquareConfigDataMap.forEach((d, key) => {
    if (d.type === SquareType.Property && d.groupId && areIdsEqual(squareState(game, key)?.owner, bot._id)) {
      groups.add(d.groupId);
    }
  });

  for (let round = 0; round < 2; round++) {
    for (const groupId of groups) {
      const ids = squaresInGroup(groupId);
      const ownAll = ids.every((id) => areIdsEqual(squareState(game, id)?.owner, bot._id));
      if (!ownAll || doesGroupHaveMortgagedProperty(game, groupId)) {
        continue;
      }
      // the square with the fewest houses keeps the group even
      const candidates = ids
        .filter((id) => (houses.get(id) ?? 0) < 5)
        .sort((a, b) => (houses.get(a) ?? 0) - (houses.get(b) ?? 0));
      if (candidates.length === 0) {
        continue;
      }
      const target = candidates[0];
      const cost = SquareConfigDataMap.get(target)?.houseCost ?? 0;
      if (cost <= 0 || cost > budget) {
        continue;
      }
      const evenGame = { ...game, squareState: game.squareState.map((s) => ({ ...s, numHouses: houses.get(s.squareId) ?? s.numHouses })) };
      if (!areHousesEven(evenGame, target, true)) {
        continue;
      }
      plan.push(target);
      budget -= cost;
      houses.set(target, (houses.get(target) ?? 0) + 1);
    }
  }
  return plan;
};

/** Where to put a spare skill point. */
export const skillChoice = (bot: Player): SkillType => {
  switch (bot.playerClass) {
    case PlayerClass.Gambler:
      return SkillType.Luck;
    case PlayerClass.Conductor:
      return SkillType.Negotiation;
    default:
      return SkillType.Corruption;
  }
};

/** Pay to leave quarantine rather than waiting for a double? */
export const shouldPayOut = (game: GameInstanceDocument, bot: Player): boolean => {
  if (level(bot) === BotLevel.Easy) {
    return bot.money >= 400;
  }
  return bot.money >= payToGetOutFee + reserveFor(game, bot);
};
