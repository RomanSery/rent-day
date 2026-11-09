import { Player } from "@core/types/Player";
import { DiceRoll } from "@core/types/DiceRoll";
import { PlayerState } from "@core/enums/PlayerState";
import {
  goToIsolationPosition,
  isolation_position,
  last_pos,
  muggingAmount,
  muggingChance,
  payToGetOutFee,
} from "@core/constants";
import { GameStatus } from "@core/enums/GameStatus";
import { SquareConfigDataMap } from "@core/config/SquareData";
import { SquareType } from "@core/enums/SquareType";
import { SquareGameData } from "@core/types/SquareGameData";
import { ServerMsg } from "@core/types/ServerMsg";
import { GameEvent } from "@core/types/GameEvent";
import { SoundMsg } from "@core/types/SoundMsg";
import { SoundType } from "@core/enums/SoundType";
import { ChatMsg } from "@core/types/ChatMsg";
import { addSeconds, formatISO } from "date-fns";
import { AuctionDocument, GameInstanceDocument } from "../model";
import { GameContext } from "../GameContext";
import { LottoProcessor } from "./LottoProcessor";
import { AuctionProcessor } from "./AuctionProcessor";
import { PropertyProcessor } from "./PropertyProcessor";
import { MoneyCalculator } from "./MoneyCalculator";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";
import { areIdsEqual, getRandomIntInclusive } from "./helpers";
import { ChanceProcessor } from "./ChanceProcessor";
import { GameProcessor } from "./GameProcessor";
import { ServerChanceEvent, toClientChanceEvent } from "./ServerChanceEvent";

export class RollProcessor {
  private ctx: GameContext;
  private userId: string;
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
    ctx: GameContext,
    userId: string,
    forceDie1: number | null,
    forceDie2: number | null
  ) {
    this.ctx = ctx;
    this.userId = userId;
    this.playerPassedPayDay = false;
    this.forceDie1 = forceDie1;
    this.forceDie2 = forceDie2;
    this.rollDesc = "";
  }

  private async init(): Promise<void> {
    this.game = await this.ctx.store.getGame();
    if (this.game) {
      this.player = this.game.players.find(
        (p: Player) => p._id && areIdsEqual(p._id, this.userId)
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

  public async roll(
    andCompleteTurn: boolean,
    incrementTimeouts: boolean
  ): Promise<string> {
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

    if (!areIdsEqual(this.userId, this.game.nextPlayerToAct)) {
      return "not your turn!";
    }

    if (this.player.hasRolled) {
      return "You already rolled this turn";
    }

    if (this.player.money < 0) {
      return (await this.handleNegativeMoney()) ?? "you cant roll with negative money;";
    }

    this.updateRollHistory();
    this.updatePlayerPosition();

    let chance: ServerChanceEvent | null = null;
    let createdAuction: boolean = false;

    if (ChanceProcessor.shouldCreateChance(this.player.position)) {
      const processor = new ChanceProcessor(this.game);
      chance = await processor.createChanceEvent();
      if (chance) {
        const moveToPos = chance.makeItHappen(this.game, this.player);
        if (moveToPos) {
          this.addChanceMovementKeyFrames(moveToPos);
          this.player.position = moveToPos;
        }
        chance.subLine = chance.getSubLine(this.game, this.player);
      }
    }

    if (AuctionProcessor.shouldCreateAuction(this.game, this.player.position)) {
      const newAuction: AuctionDocument = await AuctionProcessor.createAuction(
        this.ctx,
        this.game,
        this.player
      );
      this.game.auctionId = newAuction._id;
      this.game.auctionSquareId = newAuction.squareId;

      if (this.game.settings.useTimers) {
        this.game.nextPlayerActBy = newAuction.endsAt;
      }
      createdAuction = true;
    }

    if (
      !andCompleteTurn &&
      LottoProcessor.shouldCreateLotto(this.player.position)
    ) {
      this.game.lottoId = await LottoProcessor.createLotto(
        this.ctx,
        this.game._id,
        this.player
      );
    }

    if (this.playerPassedPayDay === true) {
      MoneyCalculator.collectSalary(this.player);
      this.player.numAbilityPoints++;
    }

    const payDesc = await MoneyCalculator.payRent(
      this.ctx,
      this.game,
      this.player
    );
    if (payDesc.length > 0) {
      this.rollDesc += "<br />" + payDesc;
    }

    const lastRoll = this.getLastRoll()!;
    this.game.results = {
      roll: { die1: lastRoll.die1, die2: lastRoll.die2 },
      description: "<b>" + this.player.name + "</b> " + this.rollDesc,
    };

    PlayerCostsCalculator.updatePlayerCosts(this.game, this.player);

    let gameEventMsg =
      "<b>" +
      this.player.name +
      "</b> - (" +
      "Roll: " +
      lastRoll.die1 +
      ", " +
      lastRoll.die2 +
      ") " +
      this.rollDesc;

    if (incrementTimeouts) {
      gameEventMsg += " - (TIMEOUT: #" + (this.player.numTimeouts + 1) + ")";
    }

    const newMsg: ChatMsg = {
      msg: gameEventMsg.replace(/<br \/>/g, " - "),
      player: "",
    };
    this.game.log.push(newMsg);

    if (andCompleteTurn && this.player.hasRolled && !createdAuction) {
      this.doCompleteTurn(true, incrementTimeouts);
    } else if (incrementTimeouts) {
      // the timer rolled for an idle player but the turn stays open (an
      // auction was created or a double was rolled): still count it
      this.player.numTimeouts++;
    }

    if (!andCompleteTurn) {
      this.player!.numTimeouts = 0;
    }

    if (!createdAuction && this.game.settings.useTimers) {
      const now = new Date();
      const actBy = addSeconds(now, this.ctx.turnTimeLimit);
      this.game.nextPlayerActBy = formatISO(actBy);
    }

    await this.ctx.store.saveGame(this.game);

    if (chance) {
      await this.ctx.events.sendDelayed(
        5000,
        GameEvent.SEND_CHANCE_EVENT,
        toClientChanceEvent(chance)
      );
    }

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

    if (!areIdsEqual(this.userId, this.game.nextPlayerToAct)) {
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

    let muggingMsg: ServerMsg | null = null;
    if (this.wasMuggedWhileTraveling()) {
      this.player.money -= muggingAmount;

      muggingMsg = {
        title: "Subway Mugging",
        body:
          this.player.name +
          " was mugged while traveling on the subway and lost $" +
          muggingAmount,
      };
    }

    PlayerCostsCalculator.updatePlayerCosts(this.game, this.player);
    await this.ctx.store.saveGame(this.game);

    if (muggingMsg) {
      await this.ctx.events.sendDelayed(
        1500,
        GameEvent.SHOW_MSG_FROM_SERVER,
        muggingMsg
      );
    }
    return "";
  }

  private wasMuggedWhileTraveling(): boolean {
    const randomNum = getRandomIntInclusive(1, 100);
    if (randomNum <= muggingChance) {
      return true;
    }
    return false;
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
          ? " <br /> Rolled a double to get out of quarantine"
          : " <br /> Left quarantine after 3 turns";
      } else {
        this.player.numTurnsInIsolation += 1;
        this.rollDesc +=
          " <br /> Still in quarantine " +
          this.player.numTurnsInIsolation +
          "/3 turns";
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
        " <br /> Caught violating social distancing and put into quarantine";

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
        " <br /> Landed on " +
        PropertyProcessor.getSquareName(this.game, this.player.position);

      if (!lastRoll.isDouble()) {
        this.player.hasRolled = true;
        this.player.rollHistory = [lastRoll];
      } else if (!gotOutOfIsolation) {
        this.rollDesc += " <br /> Rolled a double so go again";
      }

      if (lastRoll.isDouble()) {
        this.player.hasTraveled = false;
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

  private addChanceMovementKeyFrames = (moveToPos: number) => {
    const origPos = this.player!.position;

    //add a pause on the chance square
    for (let i = 0; i <= 10; i++) {
      this.movementKeyframes.push(origPos);
    }

    if (origPos > moveToPos) {
      for (let i = origPos; i <= last_pos; i++) {
        this.movementKeyframes.push(i);
      }
      for (let i = 1; i <= moveToPos; i++) {
        this.movementKeyframes.push(i);
      }
    } else {
      for (let i = origPos; i <= moveToPos; i++) {
        this.movementKeyframes.push(i);
      }
    }

    if (!this.playerPassedPayDay && moveToPos < origPos) {
      this.playerPassedPayDay = true;
      this.rollDesc += " <br /> Payday, collect your salary!";
    }
  };

  private updateRollHistory(): void {
    if (!this.player) {
      return;
    }

    const newRoll = new DiceRoll();

    if (this.ctx.isDev) {
      if (this.forceDie1 && this.forceDie2) {
        newRoll.die1 = this.forceDie1;
        newRoll.die2 = this.forceDie2;
      }
    } else if (this.forceDie1 || this.forceDie2) {
      console.log("WARNING: using forceDie");
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

  public async completeMyTurn(
    autoComplete: boolean,
    incrementTimeouts: boolean
  ): Promise<string> {
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

    if (!areIdsEqual(this.userId, this.game.nextPlayerToAct)) {
      return "not your turn";
    }

    if (this.player.money < 0) {
      return (
        (await this.handleNegativeMoney()) ??
        "you cant complete your turn with negative money;"
      );
    }

    if (!this.player.hasRolled) {
      return "you didnt roll yet";
    }

    if (!autoComplete && this.game.auctionId) {
      return "There is an active auction, place your bid first";
    }

    if (!autoComplete && this.game.lottoId) {
      return "There is an active lotto game, pick a prize first";
    }

    this.doCompleteTurn(autoComplete, incrementTimeouts);

    await this.ctx.store.saveGame(this.game);

    return "";
  }

  private doCompleteTurn(
    autoComplete: boolean,
    incrementTimeouts: boolean
  ): void {
    const nextPlayerId: string | null = RollProcessor.getNextPlayerToAct(
      this.game!,
      this.player!
    );
    if (nextPlayerId) {
      this.game!.nextPlayerToAct = nextPlayerId;

      if (this.game!.settings.useTimers) {
        const now = new Date();
        const actBy = addSeconds(now, this.ctx.turnTimeLimit);
        this.game!.nextPlayerActBy = formatISO(actBy);
      }
    }

    const nextPlayer =
      nextPlayerId &&
      this.game!.players.find((p) => p._id && areIdsEqual(p._id, nextPlayerId));

    if (nextPlayer) {
      MoneyCalculator.subtractElectricityAndTaxes(nextPlayer);
      PlayerCostsCalculator.updatePlayerCosts(this.game!, nextPlayer);
    }

    this.player!.hasRolled = false;
    this.player!.hasTraveled = false;

    if (incrementTimeouts) {
      this.player!.numTimeouts++;
    } else if (!autoComplete) {
      // the player ended the turn themselves: they are back
      this.player!.numTimeouts = 0;
    }
    // an automatic completion after the player rolled leaves the count alone

    PlayerCostsCalculator.updatePlayerCosts(this.game!, this.player!);

    if (autoComplete && this.game!.lottoId) {
      this.game!.lottoId = null;
    }

    if (this.game!.results) {
      const last = this.game!.results;
      this.game!.results = {
        roll: last.roll,
        description: last.description,
      };
    }

    if (nextPlayerId) {
      const msg: SoundMsg = {
        playerId: nextPlayerId,
        type: SoundType.YourTurn,
      };
      this.ctx.events.send(GameEvent.PLAY_SOUND_EFFECT, msg);
    }
  }

  /**
   * A player with negative money and nothing left to sell or mortgage can
   * never act again, so eliminate them instead of leaving the game stuck.
   * Returns the message for the caller, or null if the player can still
   * recover by selling/mortgaging.
   */
  private async handleNegativeMoney(): Promise<string | null> {
    if (!this.game || !this.player || this.player.totalAssets > 0) {
      return null;
    }

    await GameProcessor.bankruptPlayer(this.ctx, this.game, this.player._id);
    await this.ctx.store.saveGame(this.game);
    await this.ctx.events.refreshGameState();

    return "You have no money or assets left and are out of the game";
  }

  /**
   * The next non-bankrupt player in seating order after `player`, even when
   * `player` has just gone bankrupt themselves.
   */
  public static getNextPlayerToAct(
    game: GameInstanceDocument,
    player: Player
  ): string | null {
    if (!game || !player || game.players.length === 0) {
      return null;
    }

    const count = game.players.length;
    const index = game.players.findIndex((p) => areIdsEqual(p._id, player._id));
    const start = index === -1 ? 0 : index + 1;

    for (let step = 0; step < count; step++) {
      const candidate = game.players[(start + step) % count];
      if (candidate.state !== PlayerState.BANKRUPT) {
        return candidate._id;
      }
    }

    return null;
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
    if (!areIdsEqual(this.userId, this.game.nextPlayerToAct)) {
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

    await this.ctx.store.saveGame(this.game);
    return "";
  }
}
