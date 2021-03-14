import { AuctionDocument } from "../../core/schema/AuctionSchema";
import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { Player } from "../../core/types/Player";
import { DiceRoll } from "../../core/types/DiceRoll";
import { LottoProcessor } from "./LottoProcessor";
import { AuctionProcessor } from "./AuctionProcessor";
import { PlayerState } from "../../core/enums/PlayerState";
import { PropertyProcessor } from "./PropertyProcessor";
import { MoneyCalculator } from "./MoneyCalculator";
import {
  goToIsolationPosition,
  isolation_position,
  last_pos,
  payToGetOutFee,
} from "../../core/constants";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";
import { GameStatus } from "../../core/enums/GameStatus";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { SquareGameData } from "../../core/types/SquareGameData";
import { areIdsEqual } from "./helpers";
import { ChanceProcessor } from "./ChanceProcessor";
import { ServerChanceEvent } from "./ServerChanceEvent";

export class RollProcessor {
  private gameId: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private player?: Player | null;
  private playerPassedPayDay: boolean;

  private forceDie1: number | null;
  private forceDie2: number | null;
  private rollDesc: string;

  private origPosition: number | undefined;
  private newPosition: number | undefined;
  private lastDiceRoll: DiceRoll | undefined;
  private movementKeyframes: Array<number> = [];

  constructor(
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    forceDie1: number | null, //TODO remove or just disable
    forceDie2: number | null
  ) {
    this.gameId = gameId;
    this.userId = userId;
    this.playerPassedPayDay = false;
    this.forceDie1 = forceDie1;
    this.forceDie2 = forceDie2;
    this.rollDesc = "";
  }

  private async init(): Promise<void> {
    this.game = await GameInstance.findById(this.gameId);
    if (this.game) {
      this.player = this.game.players.find(
        (p: Player) =>
          p._id && new mongoose.Types.ObjectId(p._id).equals(this.userId)
      );

      if (this.player) {
        this.origPosition = this.player.position;
      }
    }
  }

  public getMovementKeyFrames(): Array<number> {
    return this.movementKeyframes;
  }
  public getOrigPosition(): number {
    return this.origPosition!;
  }
  public getNewPosition(): number {
    return this.newPosition!;
  }
  public getLastDiceRoll(): DiceRoll {
    return this.lastDiceRoll!;
  }

  public async roll(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (!this.player) {
      return "player not found";
    }
    if (this.player.state === PlayerState.BANKRUPT) {
      return this.player.name + " is bankrupt";
    }

    if (!this.userId.equals(this.game.nextPlayerToAct)) {
      return "not your turn!";
    }

    if (this.player.hasRolled) {
      return "You already rolled this turn";
    }

    if (this.player.money < 0) {
      return "you cant roll with negative money;";
    }

    this.updateRollHistory();
    this.updatePlayerPosition();

    if (this.playerPassedPayDay === true) {
      MoneyCalculator.collectSalary(this.player);
      this.player.numAbilityPoints++;
    }

    let chance: ServerChanceEvent | null = null;

    if (ChanceProcessor.shouldCreateChance(this.player.position)) {
      const processor = new ChanceProcessor(this.game);
      chance = await processor.createChanceEvent();
      if (chance) {
        chance.makeItHappen(this.game, this.player);
      }
    } else if (
      AuctionProcessor.shouldCreateAuction(this.game, this.player.position)
    ) {
      const newAuction: AuctionDocument = await AuctionProcessor.createAuction(
        this.game,
        this.player
      );
      this.game.auctionId = new mongoose.Types.ObjectId(newAuction._id);
      this.game.auctionSquareId = newAuction.squareId;
    } else if (LottoProcessor.shouldCreateLotto(this.player.position)) {
      this.game.lottoId = await LottoProcessor.createLotto(
        this.game.id,
        this.player
      );
    }

    const payDesc = await MoneyCalculator.payRent(this.game, this.player);
    if (payDesc.length > 0) {
      this.rollDesc += "<br />" + payDesc;
    }

    const lastRoll = this.getLastRoll()!;
    this.game.results = {
      roll: lastRoll,
      description: "<b>" + this.player.name + "</b> " + this.rollDesc,
      chance: chance,
    };

    this.game.save();
    return "";
  }

  public async travel(squareId: number): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (!this.player) {
      return "player not found";
    }
    if (this.player.state === PlayerState.BANKRUPT) {
      return this.player.name + " is bankrupt";
    }

    if (!this.userId.equals(this.game.nextPlayerToAct)) {
      return "not your turn!";
    }

    if (this.player.hasRolled) {
      return "You already rolled this turn";
    }

    if (this.player.hasTraveled) {
      return "You already traveled this turn";
    }

    if (squareId === this.player.position) {
      return "cant travel there, you are already there";
    }

    const posConfig = SquareConfigDataMap.get(this.player.position);
    if (!posConfig || posConfig.type !== SquareType.TrainStation) {
      return "you cant travel from there";
    }

    const squareConfig = SquareConfigDataMap.get(squareId);
    if (!squareConfig) {
      return "squareId not found";
    }
    if (squareConfig.type !== SquareType.TrainStation) {
      return "not a train station";
    }

    const squareData: SquareGameData | undefined = this.game.squareState.find(
      (p: SquareGameData) => p.squareId === squareId
    );
    if (!squareData) {
      return "invalid square";
    }
    if (!squareData.owner || !areIdsEqual(squareData.owner, this.player._id)) {
      return "not owned";
    }
    if (squareData.isMortgaged) {
      return "cant travel, its mortgaged";
    }

    const posData: SquareGameData | undefined = this.game.squareState.find(
      (p: SquareGameData) => p.squareId === this.player!.position
    );
    if (
      !posData ||
      !posData.owner ||
      !areIdsEqual(posData.owner, this.player._id) ||
      posData.isMortgaged
    ) {
      return "you cant travel from there (2)";
    }

    this.player.hasTraveled = true;
    this.player.position = squareId;
    this.newPosition = squareId;

    this.setMovementKeyFrames(false, false);

    this.game.save();
    return "";
  }

  private updatePlayerPosition(): void {
    if (!this.player || !this.game) {
      return;
    }
    const lastRoll = this.getLastRoll();
    if (!lastRoll) {
      return;
    }

    let gotOutOfIsolation = false;
    let updatePosition = false;
    let newPosition = this.player.position + lastRoll.sum();
    let landedOnGoToIsolation: boolean = false;
    let rolledThreeDouibles: boolean = false;

    if (this.player.state === PlayerState.IN_ISOLATION) {
      if (lastRoll.isDouble() || this.player.numTurnsInIsolation >= 2) {
        this.player.state = PlayerState.ACTIVE;
        this.player.numTurnsInIsolation = 0;
        updatePosition = true;
        gotOutOfIsolation = true;
        this.player.rollHistory = [lastRoll];
        this.rollDesc += lastRoll.isDouble()
          ? " <br /> rolled a double to get out of quarantine"
          : " <br /> left quarantine after 3 turns";
      } else {
        this.player.numTurnsInIsolation += 1;
        this.rollDesc +=
          " <br /> still in quarantine # turns:" +
          this.player.numTurnsInIsolation;
      }
      this.player.hasRolled = true;
    } else if (
      this.hasRolledThreeConsecutiveDoubles() ||
      newPosition === goToIsolationPosition
    ) {
      this.playerPassedPayDay = false;
      this.player.state = PlayerState.IN_ISOLATION;
      this.player.position = isolation_position;
      this.player.hasRolled = true;
      this.rollDesc +=
        " <br /> caught violating social distancing and put into quarantine";

      if (this.hasRolledThreeConsecutiveDoubles()) {
        rolledThreeDouibles = true;
      } else {
        landedOnGoToIsolation = newPosition === goToIsolationPosition;
      }

      this.player.rollHistory = [lastRoll];
    } else {
      updatePosition = true;
    }

    if (updatePosition) {
      if (newPosition > last_pos) {
        newPosition = newPosition - last_pos;
        this.playerPassedPayDay = true;
        this.rollDesc += " <br /> Payday, collect your salary!";
      } else {
        this.playerPassedPayDay = false;
      }

      this.player.position = newPosition;
      this.newPosition = this.player.position;

      this.rollDesc +=
        " <br /> landed on " +
        PropertyProcessor.getSquareName(this.game, this.player.position);

      if (!lastRoll.isDouble()) {
        this.player.hasRolled = true;
        this.player.rollHistory = [lastRoll];
      } else if (!gotOutOfIsolation) {
        this.rollDesc += " <br /> rolled a double so go again";
      }
    }

    this.setMovementKeyFrames(landedOnGoToIsolation, rolledThreeDouibles);
  }

  private setMovementKeyFrames = (
    landedOnGoToIsolation: boolean,
    rolledThreeDouibles: boolean
  ) => {
    this.movementKeyframes = [];

    if (!this.origPosition) {
      return;
    }

    if (landedOnGoToIsolation) {
      for (let i = this.origPosition; i <= goToIsolationPosition; i++) {
        this.movementKeyframes.push(i);
      }
      for (let x = goToIsolationPosition - 1; x >= isolation_position; x--) {
        this.movementKeyframes.push(x);
      }
    } else if (rolledThreeDouibles) {
      for (let x = this.origPosition - 1; x >= isolation_position; x--) {
        this.movementKeyframes.push(x);
      }
    } else if (this.newPosition && this.origPosition > this.newPosition) {
      for (let i = this.origPosition; i <= last_pos; i++) {
        this.movementKeyframes.push(i);
      }
      for (let i = 1; i <= this.newPosition; i++) {
        this.movementKeyframes.push(i);
      }
    } else if (this.newPosition) {
      for (let i = this.origPosition; i <= this.newPosition; i++) {
        this.movementKeyframes.push(i);
      }
    }
  };

  private updateRollHistory(): void {
    if (!this.player) {
      return;
    }

    const newRoll = new DiceRoll();
    if (this.forceDie1 && this.forceDie2) {
      newRoll.die1 = this.forceDie1;
      newRoll.die2 = this.forceDie2;
    }

    //insert latest roll into the beginning of array
    this.player.rollHistory.unshift(newRoll);
    this.lastDiceRoll = newRoll;

    if (this.player.rollHistory.length > 3) {
      this.player.rollHistory.pop();
    }
  }

  private hasRolledThreeConsecutiveDoubles(): boolean {
    if (!this.player) {
      return false;
    }

    if (this.player.rollHistory.length >= 3) {
      return (
        this.isRollDouble(this.player.rollHistory[0]) &&
        this.isRollDouble(this.player.rollHistory[1]) &&
        this.isRollDouble(this.player.rollHistory[2])
      );
    }

    return false;
  }

  private isRollDouble(roll: DiceRoll): boolean {
    if (!this.player) {
      return false;
    }
    return roll.die1 === roll.die2 ? true : false;
  }

  private getLastRoll(): DiceRoll | null {
    if (!this.player || this.player.rollHistory.length === 0) {
      return null;
    }
    return this.player.rollHistory[0];
  }

  public async completeMyTurn(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (!this.player) {
      return "player not found";
    }
    if (this.player.state === PlayerState.BANKRUPT) {
      return this.player.name + " is bankrupt";
    }

    if (this.player.money < 0) {
      return "you cant complete your turn with negative money;";
    }

    if (!this.userId.equals(this.game.nextPlayerToAct)) {
      return "not your turn";
    }

    if (!this.player.hasRolled) {
      return "you didnt roll yet";
    }

    if (this.game.lottoId) {
      return "There is an active lotto game, pick a prize first";
    }

    const nextPlayerId: mongoose.Types.ObjectId | null = RollProcessor.getNextPlayerToAct(
      this.game,
      this.player
    );
    if (nextPlayerId) {
      this.game.nextPlayerToAct = nextPlayerId;
    }

    const nextPlayer =
      nextPlayerId &&
      this.game.players.find(
        (p) => p._id && new mongoose.Types.ObjectId(p._id).equals(nextPlayerId)
      );

    if (nextPlayer) {
      MoneyCalculator.subtractElectricityAndTaxes(nextPlayer);
      PlayerCostsCalculator.updatePlayerCosts(this.game, nextPlayer);
    }

    this.player.hasRolled = false;
    this.player.hasTraveled = false;
    PlayerCostsCalculator.updatePlayerCosts(this.game, this.player);

    if (this.game.results) {
      const last = this.game.results;
      this.game.results = {
        roll: last.roll,
        description: last.description,
        chance: null,
      };
    }

    this.game.save();

    return "";
  }

  public static getNextPlayerToAct(
    game: GameInstanceDocument,
    player: Player
  ): mongoose.Types.ObjectId | null {
    if (!game || !player) {
      return null;
    }

    const activePlayers = game.players.filter(
      (p: Player) => p.state !== PlayerState.BANKRUPT
    );

    const index = activePlayers.indexOf(player);
    const nextPlayer =
      index < activePlayers.length - 1
        ? activePlayers[index + 1]
        : activePlayers[0];
    return new mongoose.Types.ObjectId(nextPlayer._id);
  }

  public async payToGetOut(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (!this.player) {
      return "player not found";
    }
    if (this.player.state === PlayerState.BANKRUPT) {
      return this.player.name + " is bankrupt";
    }
    if (!this.userId.equals(this.game.nextPlayerToAct)) {
      return "not your turn!";
    }
    if (this.player.hasRolled) {
      return "You already rolled this turn";
    }
    if (this.player.state !== PlayerState.IN_ISOLATION) {
      return "You are not in quarantine";
    }

    if (this.player.money < payToGetOutFee) {
      return "You don't have enough money to get out of quarantine";
    }

    this.player.numTurnsInIsolation = 0;
    this.player.money = Math.round(this.player.money - payToGetOutFee);
    this.player.state = PlayerState.ACTIVE;
    this.player.rollHistory = [];

    PlayerCostsCalculator.updatePlayerCosts(this.game, this.player);

    await this.game.save();
    return "";
  }
}
