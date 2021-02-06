import mongoose from "mongoose";
import { Traits } from "../traits/Traits";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { Lotto, LottoDocument } from "../../core/schema/LottoSchema";
import { Player } from "../../core/types/Player";

export class LottoProcessor {
  private optNum: number;
  private gameId: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private lotto?: LottoDocument | null;
  private player?: Player | null;

  constructor(
    optNum: number,
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ) {
    this.optNum = optNum;
    this.gameId = gameId;
    this.userId = userId;
  }

  private async init(): Promise<void> {
    this.game = await GameInstance.findById(this.gameId);
    if (this.game && this.game.lottoId) {
      this.lotto = await Lotto.findById(this.game.lottoId);
    }
    if (this.game) {
      this.player = this.game.players.find(
        (p: Player) =>
          p._id && new mongoose.Types.ObjectId(p._id).equals(this.userId)
      );
    }
  }

  public async pickOption(): Promise<string> {
    await this.init();

    if (this.game == null) {
      return "game not found";
    }
    if (this.game.lottoId == null) {
      return "no active lotto";
    }

    const playerToPick = this.game.players.find(
      (p) => p._id && new mongoose.Types.ObjectId(p._id).equals(this.userId)
    );
    if (playerToPick == null) {
      return "player not found!";
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

    const randomNum = LottoProcessor.getRandomIntInclusive(1, 100);

    this.lotto.optionPicked = this.optNum;
    this.lotto.randomNum = randomNum;

    const neededToWin = this.getChanceToWin();

    console.log(
      "randonNum: %s optionPicked: %s neededToWin: %s",
      randomNum,
      this.optNum,
      neededToWin
    );

    if (randomNum <= neededToWin) {
      this.lotto.prize = this.getPrizeAmount();
      if (this.player) {
        console.log("won");
        this.player.money = this.player.money + this.lotto.prize;
      }
    } else {
      console.log("lost");
      this.lotto.prize = 0;
    }

    this.lotto.save();

    if (this.game) {
      this.game.lottoId = null;
      this.game.save();
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
    lottoId: mongoose.Types.ObjectId
  ): Promise<LottoDocument> {
    return await Lotto.findById(
      lottoId,
      (err: mongoose.CallbackError, existing: LottoDocument) => {
        if (err) {
          return console.log(err);
        }
        return existing;
      }
    );
  }

  public static async createLotto(
    gameId: mongoose.Types.ObjectId,
    player: Player
  ): Promise<mongoose.Types.ObjectId> {
    const classType = player.playerClass;
    const luckIncrease = player.luck * 2;

    const smallPrize = LottoProcessor.getRandomIntInclusive(100, 200);
    const smallPrizePercent = 50 + luckIncrease;

    const mediumPrize = LottoProcessor.getRandomIntInclusive(230, 400);
    const mediumPrizePercent = 20 + luckIncrease;

    const largePrize = LottoProcessor.getRandomIntInclusive(430, 600);
    const largePrizePercent = 10 + luckIncrease;

    console.log(
      "small: %s medium: %s large: %s",
      smallPrize,
      mediumPrize,
      largePrize
    );

    const newObj: LottoDocument = new Lotto({
      gameId: gameId,
      playerId: player._id,
      playerName: player.name,
      playerColor: player.color,
      option1Amount: Traits.modifyLottoPrizeAmount(classType, smallPrize),
      option1Percent: smallPrizePercent,
      option2Amount: Traits.modifyLottoPrizeAmount(classType, mediumPrize),
      option2Percent: mediumPrizePercent,
      option3Amount: Traits.modifyLottoPrizeAmount(classType, largePrize),
      option3Percent: largePrizePercent,
    });

    console.log(
      "AFTER small: %s medium: %s large: %s",
      newObj.option1Amount,
      newObj.option2Amount,
      newObj.option3Amount
    );

    await newObj.save();
    return new mongoose.Types.ObjectId(newObj._id);
  }

  private static getRandomIntInclusive(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  public static shouldCreateLotto(squareId: number): boolean {
    const squareConfig = SquareConfigDataMap.get(squareId);
    if (!squareConfig) {
      return false;
    }

    return squareConfig.type === SquareType.Lotto;
  }
}
