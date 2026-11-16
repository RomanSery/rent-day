import { SquareConfigDataMap } from "@core/config/SquareData";
import { island_position, last_pos } from "@core/constants";
import { PlayerState } from "@core/enums/PlayerState";
import { SquareType } from "@core/enums/SquareType";
import { GameInstanceDocument } from "../model";
import { DiceRoll } from "@core/types/DiceRoll";
import { Player } from "@core/types/Player";
import { SquareGameData } from "@core/types/SquareGameData";
import { areIdsEqual, dollarFormatterServer } from "./helpers";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";
import { ServerChanceEvent } from "./ServerChanceEvent";
import { randomInt, shuffled } from "../random";
import { SkillType } from "@core/enums/SkillType";
import { skillChoice } from "../bots/BotBrain";
import { PropertyProcessor } from "./PropertyProcessor";
import { AuctionProcessor } from "./AuctionProcessor";

const activePlayers = (game: GameInstanceDocument): Player[] =>
  game.players.filter((p) => p.state !== PlayerState.BANKRUPT);

/** the active player worth the most (seat order breaks ties) */
const leader = (game: GameInstanceDocument): Player =>
  activePlayers(game).reduce((best, p) => (p.totalAssets > best.totalAssets ? p : best));

/** the active player worth the least (seat order breaks ties) */
const trailer = (game: GameInstanceDocument): Player =>
  activePlayers(game).reduce((worst, p) => (p.totalAssets < worst.totalAssets ? p : worst));

const auditAmount = (p: Player): number => Math.max(0, Math.round(p.money * 0.15));

/** the first square ahead of this one that is still for sale, or null */
const nearestUnownedSquare = (game: GameInstanceDocument, from: number): number | null => {
  for (let step = 1; step < last_pos; step++) {
    const squareId = ((from - 1 + step) % last_pos) + 1;
    if (AuctionProcessor.shouldCreateAuction(game, squareId)) {
      return squareId;
    }
  }
  return null;
};

const SKILLS: SkillType[] = [SkillType.Luck, SkillType.Negotiation, SkillType.Corruption];

const skillPoints = (p: Player, skill: SkillType): number =>
  skill === SkillType.Luck ? p.luck : skill === SkillType.Negotiation ? p.negotiation : p.corruption;

const addSkillPoints = (p: Player, skill: SkillType, n: number): void => {
  if (skill === SkillType.Luck) {
    p.luck += n;
  } else if (skill === SkillType.Negotiation) {
    p.negotiation += n;
  } else {
    p.corruption += n;
  }
};

/**
 * Night class: where a point studied in `to` comes from. The other skill
 * with the most points (the first of them on a tie), or null when the
 * player has no point to move into it.
 */
const nightClassSource = (p: Player, to: SkillType): SkillType | null => {
  let best: SkillType | null = null;
  for (const s of SKILLS) {
    if (s !== to && skillPoints(p, s) > 0 && (best == null || skillPoints(p, s) > skillPoints(p, best))) {
      best = s;
    }
  }
  return best;
};

/** Building inspector: $150, $25 less per Corruption point, never below $0 */
const inspectorFine = (p: Player): number => Math.max(0, 150 - 25 * p.corruption);

/** player and square names go into card text the client renders as HTML */
const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");

export class ChanceProcessor {
  private game?: GameInstanceDocument | null;
  private events: Array<ServerChanceEvent>;

  constructor(game: GameInstanceDocument) {
    this.game = game;

    this.events = [];
    this.initChanceEvents();
  }

  public async createChanceEvent(player: Player): Promise<ServerChanceEvent | null> {
    if (this.game == null) {
      return null;
    }

    const randomEvent = this.getRandomEvent(player);
    if (randomEvent) {
      return randomEvent;
    }
    return null;
  }

  /** The card with this id, for settling a choice drawn earlier. */
  public getEvent(chanceId: number): ServerChanceEvent | undefined {
    return this.events.find((e) => e.chanceId === chanceId);
  }

  /**
   * Draw from a shuffled deck, like the cards in a box: every card comes up
   * once before any comes up again, then the deck is shuffled anew. A card
   * that doesn't apply to this player right now (isAvailable) stays where it
   * is for a later draw.
   */
  private getRandomEvent(player: Player): ServerChanceEvent | undefined {
    if (!this.game) {
      return undefined;
    }
    const game = this.game;
    const fits = (id: number): boolean => {
      const e = this.getEvent(id);
      return !!e && (!e.isAvailable || e.isAvailable(game, player));
    };

    // cards removed from the game since the deck was shuffled drop out
    let deck = (game.chanceDeck ?? []).filter((id) => this.getEvent(id));
    let at = deck.findIndex(fits);
    if (at < 0) {
      deck = this.newDeck(game);
      at = deck.findIndex(fits);
    }
    if (at < 0) {
      game.chanceDeck = deck;
      return undefined;
    }
    const [chanceId] = deck.splice(at, 1);
    game.chanceDeck = deck;
    game.lastChanceId = chanceId;
    return this.getEvent(chanceId);
  }

  /** Every card, shuffled, with the one just drawn kept off the top. */
  private newDeck(game: GameInstanceDocument): number[] {
    const deck = shuffled(game, this.events.map((e) => e.chanceId));
    if (deck.length > 1 && deck[0] === game.lastChanceId) {
      deck.push(deck.shift()!);
    }
    return deck;
  }

  public static shouldCreateChance(squareId: number): boolean {
    const squareConfig = SquareConfigDataMap.get(squareId);
    if (!squareConfig) {
      return false;
    }

    return squareConfig.type === SquareType.Chance;
  }

  private initChanceEvents() {
    this.events.push({
      isGood: false,
      headline: "Dentist appointment",
      subLine: "You don't have insurance. Pay the dentist <b>$150</b>",
      chanceId: 1,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        player.money -= 150;
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        return this.subLine;
      },
    });

    this.events.push({
      isGood: false,
      headline: "Flat tire",
      subLine: "You hit a pothole. Pay <b>$120</b> to have tire replaced",
      chanceId: 2,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        player.money -= 120;
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        return this.subLine;
      },
    });

    this.events.push({
      isGood: false,
      headline: "Pay off your debts",
      subLine: "Pay back each active player <b>$30</b>",
      chanceId: 3,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        const activePlayers = game.players.filter(
          (p) =>
            p.state !== PlayerState.BANKRUPT && !areIdsEqual(p._id, player._id)
        );

        let total = 0;
        for (const p of activePlayers) {
          p.money += 30;
          total += 30;

          PlayerCostsCalculator.updatePlayerCosts(game, p);
        }

        player.money -= Math.round(total);
        PlayerCostsCalculator.updatePlayerCosts(game, player);
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        const activePlayers = game.players.filter(
          (p) =>
            p.state !== PlayerState.BANKRUPT && !areIdsEqual(p._id, player._id)
        );
        const total = 30 * activePlayers.length;
        return (
          this.subLine + "<br /> (" + dollarFormatterServer.format(total) + ")"
        );
      },
    });

    this.events.push({
      isGood: false,
      headline: "Building repairs",
      subLine:
        "Your buildings have fallen into disrepair. Pay <b>$40 per building</b>",
      chanceId: 4,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        const playerOwnedSquaresWithHouses: SquareGameData[] = game.squareState.filter(
          (s: SquareGameData) => {
            return (
              s.owner &&
              areIdsEqual(s.owner, player._id) &&
              s.numHouses > 0 &&
              !s.isMortgaged
            );
          }
        );

        let totalHouses = 0;
        for (const squareState of playerOwnedSquaresWithHouses) {
          totalHouses += squareState.numHouses;
        }

        player.money -= totalHouses * 40;
        PlayerCostsCalculator.updatePlayerCosts(game, player);
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        const playerOwnedSquaresWithHouses: SquareGameData[] = game.squareState.filter(
          (s: SquareGameData) => {
            return (
              s.owner &&
              areIdsEqual(s.owner, player._id) &&
              s.numHouses > 0 &&
              !s.isMortgaged
            );
          }
        );

        let totalHouses = 0;
        for (const squareState of playerOwnedSquaresWithHouses) {
          totalHouses += squareState.numHouses;
        }
        const total = totalHouses * 40;
        return (
          this.subLine + "<br /> (" + dollarFormatterServer.format(total) + ")"
        );
      },
    });

    this.events.push({
      isGood: false,
      headline: "Late credit card payment",
      subLine: "Pay the bank <b>10% of your money</b> in interest",
      chanceId: 5,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        const subtraction = Math.round(player.money * 0.1);
        player.money -= subtraction;
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        const subtraction = Math.round(player.money * 0.1);
        return (
          this.subLine +
          "<br /> (" +
          dollarFormatterServer.format(subtraction) +
          ")"
        );
      },
    });

    this.events.push({
      isGood: false,
      headline: "Carbon tax",
      subLine:
        "Everyone must do their part for the environment. Pay <b>5% of your money</b> for your carbon emissions",
      chanceId: 6,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        const subtraction = Math.round(player.money * 0.05);
        player.money -= subtraction;
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        const subtraction = Math.round(player.money * 0.05);
        return (
          this.subLine +
          "<br /> (" +
          dollarFormatterServer.format(subtraction) +
          ")"
        );
      },
    });

    this.events.push({
      isGood: false,
      headline: "Vehicle mileage tax",
      subLine: "Pay <b>$5</b> for each square you just moved",
      chanceId: 8,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        const lastRoll: DiceRoll = player.rollHistory[0];
        const subtraction = Math.round(lastRoll.sum() * 5);
        player.money -= subtraction;
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        const lastRoll: DiceRoll = player.rollHistory[0];
        const subtraction = Math.round(lastRoll.sum() * 5);
        return (
          this.subLine +
          "<br /> (" +
          dollarFormatterServer.format(subtraction) +
          ")"
        );
      },
    });

    //GOOD ONES

    this.events.push({
      isGood: true,
      headline: "Options trading",
      subLine: "You shorted the market and made <b>$100</b> profit",
      chanceId: 20,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        player.money += 100;
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        return this.subLine;
      },
    });

    this.events.push({
      isGood: true,
      headline: "It's your birthday!",
      subLine: "Every active player gives you a <b>$30</b> gift card",
      chanceId: 21,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        const activePlayers = game.players.filter(
          (p) =>
            p.state !== PlayerState.BANKRUPT && !areIdsEqual(p._id, player._id)
        );

        let total = 0;
        for (const p of activePlayers) {
          p.money -= 30;
          total += 30;

          PlayerCostsCalculator.updatePlayerCosts(game, p);
        }

        player.money += Math.round(total);
        PlayerCostsCalculator.updatePlayerCosts(game, player);
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        const activePlayers = game.players.filter(
          (p) =>
            p.state !== PlayerState.BANKRUPT && !areIdsEqual(p._id, player._id)
        );

        const total = activePlayers.length * 30;
        return (
          this.subLine + "<br /> (" + dollarFormatterServer.format(total) + ")"
        );
      },
    });

    this.events.push({
      isGood: true,
      headline: "Tax refund!",
      subLine:
        "The city made an error and overtaxed your properties. Get a refund of <b>$45</b> for each unmortgaged taxable property you own",
      chanceId: 22,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        const playerOwnedSquares: SquareGameData[] = game.squareState.filter(
          (s: SquareGameData) => {
            return (
              s.owner &&
              areIdsEqual(s.owner, player._id) &&
              !s.isMortgaged &&
              s.tax &&
              s.tax > 0 &&
              s.purchasePrice &&
              s.purchasePrice > 0
            );
          }
        );

        let total = 0;
        playerOwnedSquares.forEach(() => {
          total += 45;
        });

        player.money += total;
        PlayerCostsCalculator.updatePlayerCosts(game, player);
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        const playerOwnedSquares: SquareGameData[] = game.squareState.filter(
          (s: SquareGameData) => {
            return (
              s.owner &&
              areIdsEqual(s.owner, player._id) &&
              !s.isMortgaged &&
              s.tax &&
              s.tax > 0 &&
              s.purchasePrice &&
              s.purchasePrice > 0
            );
          }
        );

        const total = playerOwnedSquares.length * 45;
        return (
          this.subLine + "<br /> (" + dollarFormatterServer.format(total) + ")"
        );
      },
    });

    this.events.push({
      isGood: true,
      headline: "Take a college course",
      subLine: "Gain <b>a skill point</b>",
      chanceId: 23,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        player.numAbilityPoints += 1;
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        return this.subLine;
      },
    });

    this.events.push({
      isGood: true,
      headline: "Stimulus check",
      subLine: "Receive a <b>$200</b> handout",
      chanceId: 24,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        player.money += 200;
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        return this.subLine;
      },
    });

    this.events.push({
      isGood: true,
      headline: "Snitched",
      subLine:
        "You snitched on your neighbor for hosting a small indoor gathering. Receive a <b>$55</b> reward",
      chanceId: 27,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        player.money += 55;
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        return this.subLine;
      },
    });

    this.events.push({
      isGood: true,
      headline: "Government first",
      subLine:
        "You reported your parents to the authorities for not wearing their masks. Collect a <b>$70</b> reward",
      chanceId: 28,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        player.money += 70;
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        return this.subLine;
      },
    });

    // cards that read the drawer's skills

    // the die is rolled when the card's text is written (getSubLine, which
    // RollProcessor calls first) so the text and the payout agree
    let musicianDie: number | null = null;
    const musicianTips = (p: Player, die: number): number => 20 * die + 20 * p.luck;
    this.events.push({
      isGood: true,
      headline: "Lucky subway musician",
      subLine: "A crowd gathers around your set on the platform. Collect <b>$20 × a die roll</b> plus <b>$20 per Luck point</b>",
      chanceId: 32,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        const die = musicianDie ?? randomInt(game, 1, 6);
        musicianDie = null;
        player.money += musicianTips(player, die);
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        musicianDie = randomInt(game, 1, 6);
        return (
          this.subLine +
          "<br /> (rolled a " + musicianDie + ": " +
          dollarFormatterServer.format(musicianTips(player, musicianDie)) + ")"
        );
      },
    });

    const haggleAmount = (p: Player): number => 25 + 15 * p.negotiation;
    this.events.push({
      isGood: true,
      headline: "Flea market haggle",
      subLine: "You talk a seller down and flip the find for a profit. Collect <b>$25</b> plus <b>$15 per Negotiation point</b>",
      chanceId: 33,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        player.money += haggleAmount(player);
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        return this.subLine + "<br /> (" + dollarFormatterServer.format(haggleAmount(player)) + ")";
      },
    });

    this.events.push({
      isGood: false,
      headline: "Building inspector",
      subLine: "An inspector finds violations. Pay <b>$150</b>, less <b>$25 per Corruption point</b> slipped under the table",
      chanceId: 10,
      getIsGood(game: GameInstanceDocument, player: Player): boolean {
        return inspectorFine(player) === 0;
      },
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        player.money -= inspectorFine(player);
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        const fine = inspectorFine(player);
        return (
          this.subLine +
          "<br /> (" + (fine === 0 ? "the inspector looks the other way" : dollarFormatterServer.format(fine)) + ")"
        );
      },
    });

    this.events.push({
      isGood: true,
      headline: "Night class",
      subLine: "Retrain at night school: move <b>1 skill point</b> into another skill, or keep your skills as they are.",
      chanceId: 34,
      isAvailable(game: GameInstanceDocument, player: Player): boolean {
        return player.luck + player.negotiation + player.corruption > 0;
      },
      makeItHappen(): number | null {
        // settled through the choice below
        return null;
      },
      getSubLine(): string {
        return this.subLine;
      },
      choice: {
        getOptions(game: GameInstanceDocument, player: Player) {
          // keeping comes first: it is what a timed-out turn takes
          const options = [{ key: "keep", label: "Keep my skills" }];
          for (const to of SKILLS) {
            const from = nightClassSource(player, to);
            if (from) {
              options.push({ key: "to:" + to, label: from + " → " + to });
            }
          }
          return options;
        },
        resolve(game: GameInstanceDocument, player: Player, key: string): number | null {
          const to = SKILLS.find((s) => key === "to:" + s);
          // the skills may have changed since the card was drawn
          const from = to ? nightClassSource(player, to) : null;
          if (to && from) {
            addSkillPoints(player, from, -1);
            addSkillPoints(player, to, 1);
            PlayerCostsCalculator.updatePlayerCosts(game, player);
          }
          return null;
        },
        botPick(game: GameInstanceDocument, player: Player): string {
          // into the skill it would buy next, when that takes from a different one
          const to = skillChoice(game, player);
          return nightClassSource(player, to) ? "to:" + to : "keep";
        },
        describe(game: GameInstanceDocument, player: Player, key: string): string {
          const to = SKILLS.find((s) => key === "to:" + s);
          const from = to ? nightClassSource(player, to) : null;
          return to && from ? "Moved a point from " + from + " to " + to : "Kept their skills";
        },
      },
    });

    // cards that read the board: who's ahead, who's behind, what's still for sale

    this.events.push({
      isGood: true,
      headline: "Robin Hood",
      subLine: "The player worth the most gives <b>$50</b> to every other player",
      chanceId: 29,
      isAvailable(game: GameInstanceDocument): boolean {
        return activePlayers(game).length >= 2;
      },
      getIsGood(game: GameInstanceDocument, player: Player): boolean {
        return !areIdsEqual(leader(game)._id, player._id);
      },
      makeItHappen(game: GameInstanceDocument): number | null {
        const top = leader(game);
        for (const p of activePlayers(game)) {
          if (!areIdsEqual(p._id, top._id)) {
            p.money += 50;
            top.money -= 50;
            PlayerCostsCalculator.updatePlayerCosts(game, p);
          }
        }
        PlayerCostsCalculator.updatePlayerCosts(game, top);
        return null;
      },
      getSubLine(game: GameInstanceDocument): string {
        const top = leader(game);
        const total = 50 * (activePlayers(game).length - 1);
        return (
          this.subLine + "<br /> (" + escapeHtml(top.name) + " pays " + dollarFormatterServer.format(total) + ")"
        );
      },
    });

    this.events.push({
      isGood: true,
      headline: "Tax audit",
      subLine: "The player worth the most is audited and pays the bank <b>15% of their cash</b>",
      chanceId: 9,
      isAvailable(game: GameInstanceDocument): boolean {
        return activePlayers(game).length >= 2;
      },
      getIsGood(game: GameInstanceDocument, player: Player): boolean {
        return !areIdsEqual(leader(game)._id, player._id);
      },
      makeItHappen(game: GameInstanceDocument): number | null {
        const top = leader(game);
        top.money -= auditAmount(top);
        PlayerCostsCalculator.updatePlayerCosts(game, top);
        return null;
      },
      getSubLine(game: GameInstanceDocument): string {
        const top = leader(game);
        return (
          this.subLine + "<br /> (" + escapeHtml(top.name) + " pays " + dollarFormatterServer.format(auditAmount(top)) + ")"
        );
      },
    });

    this.events.push({
      isGood: true,
      headline: "Catch-up grant",
      subLine: "The city helps out the player worth the least. They collect <b>$150</b>",
      chanceId: 30,
      isAvailable(game: GameInstanceDocument): boolean {
        return activePlayers(game).length >= 2;
      },
      makeItHappen(game: GameInstanceDocument): number | null {
        const bottom = trailer(game);
        bottom.money += 150;
        PlayerCostsCalculator.updatePlayerCosts(game, bottom);
        return null;
      },
      getSubLine(game: GameInstanceDocument): string {
        return this.subLine + "<br /> (" + escapeHtml(trailer(game).name) + " collects $150)";
      },
    });

    this.events.push({
      isGood: false,
      headline: "Detour",
      subLine: "The road ahead is closed.",
      chanceId: 31,
      isAvailable(game: GameInstanceDocument, player: Player): boolean {
        return nearestUnownedSquare(game, player.position) != null;
      },
      makeItHappen(): number | null {
        // settled through the choice below
        return null;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        const target = nearestUnownedSquare(game, player.position)!;
        return (
          this.subLine +
          " Pay <b>$100</b> for a cab, or walk to <b>" +
          escapeHtml(PropertyProcessor.getSquareName(game, target)) +
          "</b> and put it up for auction"
        );
      },
      choice: {
        getOptions(game: GameInstanceDocument, player: Player) {
          const target = nearestUnownedSquare(game, player.position)!;
          return [
            { key: "pay", label: "Pay $100" },
            { key: "walk", label: "Walk to " + PropertyProcessor.getSquareName(game, target) },
          ];
        },
        resolve(game: GameInstanceDocument, player: Player, key: string): number | null {
          if (key === "walk") {
            // the board may have changed since the card was drawn
            return nearestUnownedSquare(game, player.position);
          }
          player.money -= 100;
          PlayerCostsCalculator.updatePlayerCosts(game, player);
          return null;
        },
        botPick(game: GameInstanceDocument, player: Player): string {
          // walking is free and puts a property up for auction; only skip it
          // when the bot is too poor to bid but can afford the cab
          return player.money >= 100 && player.money < 250 ? "pay" : "walk";
        },
        describe(game: GameInstanceDocument, player: Player, key: string): string {
          if (key === "walk") {
            const target = nearestUnownedSquare(game, player.position);
            return target == null
              ? "Chose to walk"
              : "Walked to " + escapeHtml(PropertyProcessor.getSquareName(game, target));
          }
          return "Paid $100 for a cab";
        },
      },
    });

    //move to events
    this.events.push({
      isGood: true,
      headline: "Ferry to Governors Island",
      subLine: "Take the ferry to Governors Island!",
      chanceId: 666,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        return island_position;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        return this.subLine;
      },
    });

    this.events.push({
      isGood: true,
      headline: "Trip to Wall Street",
      subLine: "Go to Wall Street to tour the stock exchange!",
      chanceId: 667,
      makeItHappen(game: GameInstanceDocument, player: Player): number | null {
        return 40;
      },
      getSubLine(game: GameInstanceDocument, player: Player): string {
        return this.subLine;
      },
    });
  }
}
