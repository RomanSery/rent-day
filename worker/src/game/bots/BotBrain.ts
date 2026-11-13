// Decision rules for computer players. Everything here is a pure function
// of the game state so it can be tuned and measured (worker/test/sim.mjs)
// without touching the turn machinery in BotPlayer.

import { SquareConfigDataMap } from "@core/config/SquareData";
import { SquareType } from "@core/enums/SquareType";
import { BotLevel } from "@core/enums/BotLevel";
import { PlayerClass } from "@core/enums/PlayerClass";
import { PlayerState } from "@core/enums/PlayerState";
import { SkillType } from "@core/enums/SkillType";
import { Player } from "@core/types/Player";
import { SquareGameData } from "@core/types/SquareGameData";
import { conEd_position, mta_position, payToGetOutFee } from "@core/constants";
import { AuctionDocument, GameInstanceDocument, LottoDocument, TradeDocument } from "../model";
import { areIdsEqual, doesGroupHaveMortgagedProperty } from "../controllers/helpers";
import { random } from "../random";

// --- board helpers -------------------------------------------------------

const level = (bot: Player): BotLevel => bot.botLevel ?? BotLevel.Normal;
const isEasy = (bot: Player): boolean => level(bot) === BotLevel.Easy;

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
    if (d.type === SquareType.TrainStation && areIdsEqual(squareState(game, key)?.owner, playerId)) {
      n++;
    }
  });
  return n;
};

const ownsAllInGroup = (game: GameInstanceDocument, playerId: string, groupId: number): boolean =>
  squaresInGroup(groupId).every((id) => areIdsEqual(squareState(game, id)?.owner, playerId));

const activePlayers = (game: GameInstanceDocument): Player[] =>
  game.players.filter((p) => p.state !== PlayerState.BANKRUPT);

const opponentsOf = (game: GameInstanceDocument, bot: Player): Player[] =>
  activePlayers(game).filter((p) => !areIdsEqual(p._id, bot._id));

const playerById = (game: GameInstanceDocument, id: string | null | undefined): Player | undefined =>
  game.players.find((p) => areIdsEqual(p._id, id));

/** Probability of each dice sum 2..12. */
const DICE_PROB: Record<number, number> = {
  2: 1 / 36, 3: 2 / 36, 4: 3 / 36, 5: 4 / 36, 6: 5 / 36, 7: 6 / 36,
  8: 5 / 36, 9: 4 / 36, 10: 3 / 36, 11: 2 / 36, 12: 1 / 36,
};

const wrap = (pos: number): number => ((pos - 1) % 40 + 40) % 40 + 1;

/** Assumed remaining length of the game, in turns, from the current turn. */
const horizonTurns = (game: GameInstanceDocument): number =>
  Math.max(60, 300 - (game.turnNumber ?? 0));

/**
 * How many times a single opponent is expected to land on one particular
 * square before the game ends: a player makes about 5.7 landings per lap
 * (40 squares / 7 per roll), so each square gets ~0.14 landings per lap.
 */
const landingsPerOpponent = (game: GameInstanceDocument): number => {
  const players = Math.max(2, activePlayers(game).length);
  const turnsEach = horizonTurns(game) / players;
  const laps = (turnsEach * 7) / 40;
  return laps * 0.14;
};

/**
 * Rent a visitor pays on a square owned by `ownerId` with `houses` houses,
 * ignoring the visitor's class and negotiation.
 */
export const rentAt = (
  game: GameInstanceDocument,
  squareId: number,
  ownerId: string,
  houses?: number
): number => {
  const config = SquareConfigDataMap.get(squareId);
  const state = squareState(game, squareId);
  if (!config || !state) {
    return 0;
  }
  if (config.type === SquareType.Property) {
    const n = houses ?? state.numHouses;
    const table = [state.rent0, state.rent1, state.rent2, state.rent3, state.rent4, state.rent5];
    let rent = table[Math.min(5, Math.max(0, n))] ?? 0;
    if (n === 0 && config.groupId && ownsAllInGroup(game, ownerId, config.groupId)) {
      rent *= 2;
    }
    return rent;
  }
  if (config.type === SquareType.TrainStation) {
    const owned = Math.max(1, stationsOwnedBy(game, ownerId));
    const table = [state.rent0 ?? 25, state.rent1 ?? 50, state.rent2 ?? 100, state.rent3 ?? 200];
    let rent = table[Math.min(4, owned) - 1] ?? 0;
    if (areIdsEqual(squareState(game, mta_position)?.owner, ownerId)) {
      rent *= 2;
    }
    return rent;
  }
  return 0;
};

/** Rent `player` would owe if they landed on `squareId` right now. */
const rentOwedAt = (game: GameInstanceDocument, player: Player, squareId: number): number => {
  const state = squareState(game, squareId);
  if (!state || !state.owner || areIdsEqual(state.owner, player._id) || state.isMortgaged) {
    return 0;
  }
  const owner = playerById(game, state.owner);
  if (!owner || owner.state !== PlayerState.ACTIVE) {
    return 0;
  }
  return rentAt(game, squareId, owner._id);
};

/** Expected rent for the next roll from `fromPos`. */
export const expectedRentAhead = (game: GameInstanceDocument, player: Player, fromPos: number): number => {
  let total = 0;
  for (let sum = 2; sum <= 12; sum++) {
    total += DICE_PROB[sum] * rentOwedAt(game, player, wrap(fromPos + sum));
  }
  return Math.round(total);
};

/** The largest rent reachable with the next roll from `fromPos`. */
export const maxRentAhead = (game: GameInstanceDocument, player: Player, fromPos: number): number => {
  let worst = 0;
  for (let sum = 2; sum <= 12; sum++) {
    worst = Math.max(worst, rentOwedAt(game, player, wrap(fromPos + sum)));
  }
  return worst;
};

// --- money -----------------------------------------------------------------

/** Cash the bot wants to keep on hand for taxes, electricity and rent. */
export const reserveFor = (game: GameInstanceDocument, bot: Player): number => {
  const perTurn = bot.taxesPerTurn + bot.electricityCostsPerTurn;
  const base = isEasy(bot) ? 250 : 100;
  return base + perTurn * 3;
};

/**
 * Cash the bot should hold before rolling: the worst rent it can hit this
 * roll, or null when it already has enough.
 */
export const cashTarget = (game: GameInstanceDocument, bot: Player): number | null => {
  if (isEasy(bot)) {
    return null;
  }
  const worst = maxRentAhead(game, bot, bot.position);
  return bot.money < worst ? worst : null;
};

// --- valuation ---------------------------------------------------------------

/** What a square is worth to this bot, in dollars, if it owned it. */
export const valueOf = (game: GameInstanceDocument, bot: Player, squareId: number): number => {
  const config = SquareConfigDataMap.get(squareId);
  const state = squareState(game, squareId);
  if (!config || !state) {
    return 0;
  }
  const opponents = opponentsOf(game, bot).length;
  const landings = landingsPerOpponent(game) * opponents;

  let value = 0;

  if (config.type === SquareType.Property) {
    const groupId = config.groupId ?? 0;
    const others = squaresInGroup(groupId).filter((id) => id !== squareId);
    const mine = others.filter((id) => areIdsEqual(squareState(game, id)?.owner, bot._id)).length;
    const rivals = others.filter((id) => {
      const owner = squareState(game, id)?.owner;
      return owner && !areIdsEqual(owner, bot._id) && playerById(game, owner)?.state !== PlayerState.BANKRUPT;
    });

    // rent as it would be once the bot owns it
    const completes = mine === others.length;
    const base = (state.rent0 ?? 0) * (completes ? 2 : 1);
    value = base * landings;

    // upside from building once the group is complete
    const houseCost = config.houseCost ?? 0;
    const rent3 = state.rent3 ?? 0;
    const buildGain = Math.max(0, rent3 * landings - 3 * houseCost);
    if (completes) {
      value += buildGain * 0.6;
    } else if (rivals.length === 0) {
      value += buildGain * 0.25; // still possible, needs more squares
    }

    if (rivals.length > 0) {
      value *= 0.7; // a rival can block the group
    }

    // blocking: does this square complete a rival's group?
    const rivalOwners = new Set(rivals.map((id) => squareState(game, id)!.owner!));
    for (const rivalId of rivalOwners) {
      const theirs = others.filter((id) => areIdsEqual(squareState(game, id)?.owner, rivalId)).length;
      if (theirs === others.length) {
        const rivalRent3 = rent3 * landings * 0.5;
        value += Math.min(rivalRent3, 300);
      }
    }
  } else if (config.type === SquareType.TrainStation) {
    const owned = stationsOwnedBy(game, bot._id) + 1;
    const table = [25, 50, 100, 200];
    const rent = table[Math.min(4, owned) - 1];
    // more stations also raise the rent of the ones already owned
    const upgrade = owned > 1 ? (rent - table[owned - 2]) * (owned - 1) : 0;
    value = (rent + upgrade) * landings;
  } else if (config.type === SquareType.Utility) {
    if (squareId === mta_position) {
      value = 60 + 40 * stationsOwnedBy(game, bot._id);
    } else if (squareId === conEd_position) {
      value = 80 + 15 * bot.electricityCostsPerTurn;
    } else {
      value = 60;
    }
  }

  if (isEasy(bot)) {
    value *= 0.6;
  }
  return Math.round(value);
};

const jitter = (game: GameInstanceDocument, amount: number, spread: number): number =>
  amount * (1 - spread + random(game) * spread * 2);

/** The silent bid for the square under auction (second-price, so bid value). */
export const bidFor = (game: GameInstanceDocument, auction: AuctionDocument, bot: Player): number => {
  if (bot.state === PlayerState.IN_ISOLATION) {
    return 0;
  }
  const value = valueOf(game, bot, auction.squareId);
  // keep enough to survive the worst rent on the next roll, counting what
  // could be raised by mortgaging
  const exposure = Math.max(0, maxRentAhead(game, bot, bot.position) - bot.mortgageableValue);
  const cap = isEasy(bot)
    ? Math.floor(bot.money * 0.3)
    : bot.money - Math.max(reserveFor(game, bot), exposure);
  const amount = Math.round(jitter(game, Math.min(value, cap), 0.08));
  if (amount < 5) {
    return 0;
  }
  return Math.max(0, Math.min(amount, bot.money));
};

/** Which lotto option to take. */
export const lottoChoice = (lotto: LottoDocument, bot: Player): number => {
  if (isEasy(bot)) {
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

// --- trades -------------------------------------------------------------------

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
  // what the bot gives up is worth its value to the bot, plus the rent the
  // other side gains from it (they would not ask otherwise)
  const given =
    asked.amountGiven +
    asked.squaresGiven.reduce((sum, id) => sum + valueOf(game, bot, id) * 1.2, 0);

  const margin = isEasy(bot) ? 1.3 : 1.1;
  return received >= given * margin && received > 0;
};

export interface TradeProposal {
  toPlayerId: string;
  squareId: number;
  amount: number;
}

/**
 * A purchase offer for the one square that would complete one of the bot's
 * colour groups, if an active opponent owns it and the bot can afford it.
 */
export const tradeProposal = (game: GameInstanceDocument, bot: Player): TradeProposal | null => {
  if (isEasy(bot)) {
    return null;
  }
  const budget = bot.money - reserveFor(game, bot);
  if (budget < 50) {
    return null;
  }

  let best: TradeProposal | null = null;
  const groups = new Set<number>();
  SquareConfigDataMap.forEach((d, key) => {
    if (d.type === SquareType.Property && d.groupId && areIdsEqual(squareState(game, key)?.owner, bot._id)) {
      groups.add(d.groupId);
    }
  });

  for (const groupId of groups) {
    const ids = squaresInGroup(groupId);
    const missing = ids.filter((id) => !areIdsEqual(squareState(game, id)?.owner, bot._id));
    if (missing.length !== 1) {
      continue;
    }
    const state = squareState(game, missing[0])!;
    const owner = playerById(game, state.owner);
    if (!owner || owner.state === PlayerState.BANKRUPT || state.numHouses > 0) {
      continue;
    }
    // pay up to 1.3x what the square is worth to us, within budget
    const amount = Math.min(budget, Math.round(valueOf(game, bot, missing[0]) * 1.3));
    if (amount < 30) {
      continue;
    }
    if (!best || amount > best.amount) {
      best = { toPlayerId: owner._id, squareId: missing[0], amount };
    }
  }
  return best;
};

// --- building -------------------------------------------------------------------

/** Squares to build a house on this turn, in order, best return first. */
export const buildPlan = (game: GameInstanceDocument, bot: Player): number[] => {
  if (isEasy(bot)) {
    return [];
  }
  const landings = landingsPerOpponent(game) * opponentsOf(game, bot).length;
  const plan: number[] = [];
  let budget = bot.money - reserveFor(game, bot);

  const houses = new Map<number, number>();
  game.squareState.forEach((s) => houses.set(s.squareId, s.numHouses));

  const groups = new Set<number>();
  SquareConfigDataMap.forEach((d, key) => {
    if (d.type === SquareType.Property && d.groupId && areIdsEqual(squareState(game, key)?.owner, bot._id)) {
      groups.add(d.groupId);
    }
  });

  for (let round = 0; round < 3; round++) {
    let best: { squareId: number; cost: number; score: number } | null = null;

    for (const groupId of groups) {
      if (!ownsAllInGroup(game, bot._id, groupId) || doesGroupHaveMortgagedProperty(game, groupId)) {
        continue;
      }
      const ids = squaresInGroup(groupId);
      const minHouses = Math.min(...ids.map((id) => houses.get(id) ?? 0));
      for (const id of ids) {
        const n = houses.get(id) ?? 0;
        if (n !== minHouses || n >= 5) {
          continue; // build evenly
        }
        const cost = SquareConfigDataMap.get(id)?.houseCost ?? 0;
        if (cost <= 0 || cost > budget) {
          continue;
        }
        const gain = (rentAt(game, id, bot._id, n + 1) - rentAt(game, id, bot._id, n)) * landings;
        const score = gain / cost;
        if (score >= 0.4 && (!best || score > best.score)) {
          best = { squareId: id, cost, score };
        }
      }
    }

    if (!best) {
      break;
    }
    plan.push(best.squareId);
    budget -= best.cost;
    houses.set(best.squareId, (houses.get(best.squareId) ?? 0) + 1);
  }
  return plan;
};

// --- misc decisions -------------------------------------------------------------

/** Where to put a spare skill point. */
export const skillChoice = (game: GameInstanceDocument, bot: Player): SkillType => {
  const perTurn = bot.taxesPerTurn + bot.electricityCostsPerTurn;
  const rivalRentSquares = game.squareState.filter((s) => {
    const owner = playerById(game, s.owner);
    return owner && !areIdsEqual(owner._id, bot._id) && owner.state !== PlayerState.BANKRUPT && !s.isMortgaged;
  }).length;

  if (perTurn >= 15) {
    return SkillType.Corruption;
  }
  if (rivalRentSquares >= 4) {
    return SkillType.Negotiation;
  }
  if (bot.playerClass === PlayerClass.Gambler) {
    return SkillType.Luck;
  }
  return SkillType.Negotiation;
};

/** Pay to leave quarantine rather than waiting for a double? */
export const shouldPayOut = (game: GameInstanceDocument, bot: Player): boolean => {
  if (isEasy(bot)) {
    return bot.money >= 400;
  }
  if (bot.money < payToGetOutFee + reserveFor(game, bot)) {
    return false;
  }
  // quarantine is shelter when the board ahead is expensive
  const danger = expectedRentAhead(game, bot, bot.position);
  return danger < Math.max(40, bot.money * 0.05);
};

/**
 * Take the subway from the current station to another owned station when
 * that clearly lowers the rent risk of the next roll.
 */
export const travelChoice = (game: GameInstanceDocument, bot: Player): number | null => {
  if (isEasy(bot) || !bot.canTravel || bot.hasTraveled) {
    return null;
  }
  const here = expectedRentAhead(game, bot, bot.position);
  const candidates: Array<{ squareId: number; risk: number }> = [];
  SquareConfigDataMap.forEach((d, key) => {
    if (d.type !== SquareType.TrainStation || key === bot.position) {
      return;
    }
    const s = squareState(game, key);
    if (!s || !areIdsEqual(s.owner, bot._id) || s.isMortgaged) {
      return;
    }
    candidates.push({ squareId: key, risk: expectedRentAhead(game, bot, key) });
  });
  candidates.sort((a, b) => a.risk - b.risk);
  const best = candidates[0];
  // the mugging risk costs about $30 in expectation
  if (best && here - best.risk > 60) {
    return best.squareId;
  }
  return null;
};
