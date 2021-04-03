import _ from "lodash";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { PlayerState } from "../../core/enums/PlayerState";
import { SquareType } from "../../core/enums/SquareType";
import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
import { DiceRoll } from "../../core/types/DiceRoll";
import { Player } from "../../core/types/Player";
import { SquareGameData } from "../../core/types/SquareGameData";
import { areIdsEqual } from "./helpers";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";
import { ServerChanceEvent } from "./ServerChanceEvent";

export class ChanceProcessor {
  private game?: GameInstanceDocument | null;
  private events: Array<ServerChanceEvent>;

  constructor(game: GameInstanceDocument) {
    this.game = game;

    this.events = [];
    this.initChanceEvents();
  }

  public async createChanceEvent(): Promise<ServerChanceEvent | null> {
    if (this.game == null) {
      return null;
    }

    const randomEvent = this.getRandomEvent();
    if (randomEvent) {
      return randomEvent;
    }
    return null;
  }

  private getRandomEvent(): ServerChanceEvent | undefined {
    return _.sample(this.events);
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
      subLine: "You don't have insurance, pay dentist <b>$150</b>",
      chanceId: 1,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
        player.money -= 150;
        return false;
      },
    });

    this.events.push({
      isGood: false,
      headline: "Flat tire",
      subLine: "You hit a pothole. Pay <b>$120</b> to have tire replaced",
      chanceId: 2,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
        player.money -= 120;
        return false;
      },
    });

    this.events.push({
      isGood: false,
      headline: "Pay off your debts",
      subLine: "Pay each active player <b>$30</b>",
      chanceId: 3,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
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
        return false;
      },
    });

    this.events.push({
      isGood: false,
      headline: "Building repairs",
      subLine:
        "Your buildings have fallen into disrepair.  Pay <b>$40 per building</b>",
      chanceId: 4,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
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
        return false;
      },
    });

    this.events.push({
      isGood: false,
      headline: "Late credit card payment",
      subLine: "Pay the bank <b>10% of your money</b> in interest",
      chanceId: 5,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
        const subtraction = Math.round(player.money * 0.1);
        player.money -= subtraction;
        return false;
      },
    });

    this.events.push({
      isGood: false,
      headline: "Carbon Tax",
      subLine:
        "Everyone must do their part for the environment. Pay <b>5% of your money</b> for your carbon emissions",
      chanceId: 6,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
        const subtraction = Math.round(player.money * 0.05);
        player.money -= subtraction;
        return false;
      },
    });

    this.events.push({
      isGood: false,
      headline: "Vehicle Mileage Tax",
      subLine: "Pay $5 for each square you just moved",
      chanceId: 8,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
        const lastRoll: DiceRoll = player.rollHistory[0];
        const subtraction = Math.round(lastRoll.sum() * 5);
        player.money -= subtraction;
        return false;
      },
    });

    //GOOD ONES

    this.events.push({
      isGood: true,
      headline: "Options trading",
      subLine: "You shorted the market and made <b>$100</b> profit",
      chanceId: 20,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
        player.money += 100;
        return false;
      },
    });

    this.events.push({
      isGood: true,
      headline: "It's your birthday!",
      subLine: "Every active player gives you a $30 gift card",
      chanceId: 21,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
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
        return false;
      },
    });

    this.events.push({
      isGood: true,
      headline: "Tax refund!",
      subLine:
        "The city has made an error and your properties have been overtaxed.  <br> Get a refund of $45 for each unmortgaged taxable property you own",
      chanceId: 22,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
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
        return false;
      },
    });

    this.events.push({
      isGood: true,
      headline: "Take a college course",
      subLine: "Gain a skill point",
      chanceId: 23,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
        player.numAbilityPoints += 1;
        return false;
      },
    });

    this.events.push({
      isGood: true,
      headline: "Stimulus check",
      subLine: "Recieve a $200 handout",
      chanceId: 24,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
        player.money += 200;
        return false;
      },
    });

    this.events.push({
      isGood: true,
      headline: "Snitched",
      subLine:
        "You snitched on your neighbor for hosting a small indoor gathering. Recieve a $55 reward",
      chanceId: 27,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
        player.money += 55;
        return false;
      },
    });

    this.events.push({
      isGood: true,
      headline: "Government First",
      subLine:
        "Your reported your parents to the authorities for not wearing their masks.  Collect a $70 reward",
      chanceId: 28,
      makeItHappen(game: GameInstanceDocument, player: Player): boolean {
        player.money += 70;
        return false;
      },
    });
  }
}
