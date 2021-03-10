import { SquareConfigDataMap } from "../../core/config/SquareData";
import { GameStatus } from "../../core/enums/GameStatus";
import { SquareType } from "../../core/enums/SquareType";
import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
import { ChanceEvent } from "../../core/types/ChanceEvent";
import { Player } from "../../core/types/Player";

export class ChanceProcessor {
  private game?: GameInstanceDocument | null;
  private player?: Player | null;

  constructor(game: GameInstanceDocument, player: Player) {
    this.game = game;
    this.player = player;
  }

  public async createChanceEvent(): Promise<ChanceEvent | null> {
    if (this.game == null) {
      return null;
    }
    if (this.game.status !== GameStatus.ACTIVE) {
      return null;
    }

    return this.getRandomEvent();
  }

  private getRandomEvent(): ChanceEvent {
    return {
      isGood: false,
      headline: "Got a toothace",
      subLine: "Pay dentist $50",
      chanceId: 1,
    };
  }

  public static shouldCreateChance(squareId: number): boolean {
    const squareConfig = SquareConfigDataMap.get(squareId);
    if (!squareConfig) {
      return false;
    }

    return squareConfig.type === SquareType.Chance;
  }
}
