import _ from "lodash";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
import { Player } from "../../core/types/Player";
import { ServerChanceEvent } from "./ServerChanceEvent";

export class ChanceProcessor {
  private game?: GameInstanceDocument | null;
  private player?: Player | null;
  private events: Array<ServerChanceEvent>;

  constructor(game: GameInstanceDocument, player: Player) {
    this.game = game;
    this.player = player;

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
  }
}
