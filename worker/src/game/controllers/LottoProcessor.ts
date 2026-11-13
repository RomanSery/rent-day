import { SquareConfigDataMap } from "@core/config/SquareData";
import { SquareType } from "@core/enums/SquareType";
import { Player } from "@core/types/Player";
import { GameStatus } from "@core/enums/GameStatus";
import { PlayerState } from "@core/enums/PlayerState";
import { luckAdjustment } from "@core/constants";
import { formatISO } from "date-fns";
import { GameInstanceDocument, LottoDocument } from "../model";
import { GameContext } from "../GameContext";
import { newId } from "../ids";
import { Traits } from "../traits/Traits";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";
import { areIdsEqual } from "./helpers";
import { randomInt } from "../random";

export class LottoProcessor {
  private ctx: GameContext;
  private optNum: number;
  private userId: string;
  private game?: GameInstanceDocument | null;
  private lotto?: LottoDocument | null;
  private player?: Player | null;

  constructor(ctx: GameContext, optNum: number, userId: string) {
    this.ctx = ctx;
    this.optNum = optNum;
    this.userId = userId;
  }

  private async init(): Promise<void> {
    this.game = await this.ctx.store.getGame();
    if (this.game && this.game.lottoId) {
      this.lotto = await this.ctx.store.getLotto(this.game.lottoId);
    }
    if (this.game) {
      this.player = this.game.players.find(
        (p: Player) => p._id && areIdsEqual(p._id, this.userId)
      );
    }
  }

  public async pickOption(): Promise<string> {
    await this.init();

    if (this.game == null) {
      return "game not found";
    }
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (this.game.lottoId == null) {
      return "no active lotto";
    }

    const playerToPick = this.game.players.find(
      (p) => p._id && areIdsEqual(p._id, this.userId)
    );
    if (playerToPick == null) {
      return "player not found!";
    }
    if (playerToPick.state === PlayerState.BANKRUPT) {
      return playerToPick.name + " is bankrupt";
    }

    if (this.lotto == null) {
      return "lotto not found";
    }
    if (this.lotto.prize) {
      return "lotto is finished";
    }

    if (this.optNum < 1 || this.optNum > 3) {
      return "invalid picked option";
    }

    if (!areIdsEqual(this.lotto.playerId, this.userId)) {
      return "Not your lotto game";
    }

    const randomNum = randomInt(this.game!, 1, 100);

    this.lotto.optionPicked = this.optNum;
    this.lotto.randomNum = randomNum;

    const neededToWin = this.getChanceToWin();

    if (randomNum <= neededToWin) {
      this.lotto.prize = this.getPrizeAmount();
      if (this.player) {
        this.player.money = Math.round(this.player.money + this.lotto.prize);
        PlayerCostsCalculator.updatePlayerCosts(this.game, this.player);
      }
    } else {
      this.lotto.prize = 0;
    }

    await this.ctx.store.saveLotto(this.lotto);

    if (this.game) {
      this.game.lottoId = null;
      await this.ctx.store.saveGame(this.game);
    }

    return "";
  }

  private getPrizeAmount(): number {
    if (!this.game || !this.lotto) {
      return 0;
    }

    if (this.optNum === 1) {
      return this.lotto.option1Amount;
    }
    if (this.optNum === 2) {
      return this.lotto.option2Amount;
    }
    if (this.optNum === 3) {
      return this.lotto.option3Amount;
    }

    return 0;
  }

  private getChanceToWin(): number {
    if (!this.game || !this.lotto) {
      return 0;
    }

    if (this.optNum === 1) {
      return this.lotto.option1Percent;
    }
    if (this.optNum === 2) {
      return this.lotto.option2Percent;
    }
    if (this.optNum === 3) {
      return this.lotto.option3Percent;
    }

    return 0;
  }

  public static async getLotto(
    ctx: GameContext,
    lottoId: string
  ): Promise<LottoDocument | null> {
    return await ctx.store.getLotto(lottoId);
  }

  public static async createLotto(
    ctx: GameContext,
    game: GameInstanceDocument,
    player: Player
  ): Promise<string> {
    const classType = player.playerClass;
    const luckIncrease = player.luck * luckAdjustment;

    const smallPrize = randomInt(game, 100, 200);
    const smallPrizePercent = 50 + luckIncrease;

    const mediumPrize = randomInt(game, 230, 400);
    const mediumPrizePercent = 20 + luckIncrease;

    const largePrize = randomInt(game, 430, 600);
    const largePrizePercent = 10 + luckIncrease;

    const newObj: LottoDocument = {
      _id: newId(),
      gameId: game._id,
      playerId: player._id,
      playerName: player.name,
      playerColor: player.color,
      option1Amount: Traits.modifyLottoPrizeAmount(classType, smallPrize),
      option1Percent: smallPrizePercent,
      option2Amount: Traits.modifyLottoPrizeAmount(classType, mediumPrize),
      option2Percent: mediumPrizePercent,
      option3Amount: Traits.modifyLottoPrizeAmount(classType, largePrize),
      option3Percent: largePrizePercent,
      optionPicked: null,
      randomNum: null,
      prize: null,
      createdAt: formatISO(new Date()),
    };

    await ctx.store.saveLotto(newObj);
    return newObj._id;
  }

  public static shouldCreateLotto(squareId: number): boolean {
    const squareConfig = SquareConfigDataMap.get(squareId);
    if (!squareConfig) {
      return false;
    }

    return squareConfig.type === SquareType.Lotto;
  }
}
