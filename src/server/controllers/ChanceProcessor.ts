import _ from "lodash";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { PlayerState } from "../../core/enums/PlayerState";
import { SquareType } from "../../core/enums/SquareType";
import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
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
      headline: "Got a toothace",
      subLine: "Pay dentist $50",
      chanceId: 1,
      makeItHappen(game: GameInstanceDocument, player: Player): void {
        player.money -= 50;
      },
    });

    this.events.push({
      isGood: true,
      headline: "Sell stocks",
      subLine: "Get $75",
      chanceId: 2,
      makeItHappen(game: GameInstanceDocument, player: Player): void {
        player.money += 75;
      },
    });

    this.events.push({
      isGood: true,
      headline: "It's your birthday!",
      subLine: "Every active player gives you a $30 gift card",
      chanceId: 3,
      makeItHappen(game: GameInstanceDocument, player: Player): void {
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
      },
    });

    this.events.push({
      isGood: false,
      headline: "Pay off your debts",
      subLine: "Pay each active player $30",
      chanceId: 4,
      makeItHappen(game: GameInstanceDocument, player: Player): void {
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
      },
    });

    this.events.push({
      isGood: false,
      headline: "Building repairs",
      subLine:
        "Your buildings have fallen into disrepair.  Pay $40 per building",
      chanceId: 5,
      makeItHappen(game: GameInstanceDocument, player: Player): void {
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
      },
    });

    this.events.push({
      isGood: true,
      headline: "Tax refund!",
      subLine:
        "The city has made an error and your properties have been overtaxed.  <br> Get a refund of $45 for each unmortgaged taxable property you own",
      chanceId: 6,
      makeItHappen(game: GameInstanceDocument, player: Player): void {
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
      },
    });
  }
}
