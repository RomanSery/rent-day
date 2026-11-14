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
import { randomPick } from "../random";
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

  private getRandomEvent(player: Player): ServerChanceEvent | undefined {
    if (!this.game) {
      return undefined;
    }
    const game = this.game;
    const deck = this.events.filter((e) => !e.isAvailable || e.isAvailable(game, player));
    return randomPick(game, deck);
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
