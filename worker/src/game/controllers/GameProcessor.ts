import _ from "lodash";
import { SquareThemeData } from "@core/types/SquareThemeData";
import { NyThemeData } from "@core/config/NyTheme";
import { GameStatus } from "@core/enums/GameStatus";
import { PlayerState } from "@core/enums/PlayerState";
import { JoinResult } from "@core/types/JoinResult";
import { Player } from "@core/types/Player";
import { PieceType } from "@core/enums/PieceType";
import { PlayerClass } from "@core/enums/PlayerClass";
import { SquareGameData } from "@core/types/SquareGameData";
import { SquareConfigDataMap } from "@core/config/SquareData";
import { SquareConfigData } from "@core/types/SquareConfigData";
import { ServerMsg } from "@core/types/ServerMsg";
import { player_colors } from "@core/constants";
import { SkillSettings } from "@core/types/SkillSettings";
import { SquareType } from "@core/enums/SquareType";
import { GameEvent } from "@core/types/GameEvent";
import {
  addSeconds,
  differenceInMinutes,
  formatISO,
  parseISO,
} from "date-fns";
import { GameInstanceDocument, UserDocument } from "../model";
import { GameContext } from "../GameContext";
import { areIdsEqual } from "./helpers";
import { MoneyCalculator } from "./MoneyCalculator";
import { Traits } from "../traits/Traits";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";
import { RollProcessor } from "./RollProcessor";
import { PlayerProcessor } from "./PlayerProcessor";
import { hashPassword, verifyPassword } from "../../auth/password";
import { BotLevel } from "@core/enums/BotLevel";
import { createBotPlayer } from "../bots/BotPlayer";

const GAME_PASSWORD_ITERATIONS = 10000;

export interface CreateGameParams {
  gameId: string;
  gameName: string;
  maxPlayers: number;
  initialMoney: number;
  initialSkillPoints: number;
  userId: string;
  password: string | null;
  useTimers: boolean;
  /** development only: no human seats, the game runs itself */
  botsOnly?: boolean;
}

export class GameProcessor {
  public static async createGame(
    ctx: GameContext,
    params: CreateGameParams
  ): Promise<GameInstanceDocument> {
    const themeData: Record<string, SquareThemeData> = {};
    NyThemeData.forEach((value: SquareThemeData, key: number) => {
      themeData[_.toString(key)] = value;
    });

    const squareState: SquareGameData[] = [];
    SquareConfigDataMap.forEach((d: SquareConfigData, key: number) => {
      const squareData: SquareGameData = {
        squareId: key,
        numHouses: 0,
        isMortgaged: false,
        houseCost: d.houseCost ? d.houseCost : 0,
        tax: d.tax ? d.tax : 0,
        electricityCost: d.electricityCost ? d.electricityCost : 0,
        rent0: d.rent && d.rent.has(0) ? d.rent.get(0) : undefined,
        rent1: d.rent && d.rent.has(1) ? d.rent.get(1) : undefined,
        rent2: d.rent && d.rent.has(2) ? d.rent.get(2) : undefined,
        rent3: d.rent && d.rent.has(3) ? d.rent.get(3) : undefined,
        rent4: d.rent && d.rent.has(4) ? d.rent.get(4) : undefined,
        rent5: d.rent && d.rent.has(5) ? d.rent.get(5) : undefined,
      };

      squareState.push(squareData);
    });

    const password =
      params.password && params.password.length > 0
        ? await hashPassword(params.password, GAME_PASSWORD_ITERATIONS)
        : null;

    const now = formatISO(new Date());
    const newGame: GameInstanceDocument = {
      _id: params.gameId,
      name: params.gameName,
      theme: themeData,
      squareState: squareState,
      allJoined: false,
      settings: {
        initialMoney: params.initialMoney,
        initialSkillPoints: params.initialSkillPoints,
        maxPlayers: params.maxPlayers,
        password: password,
        useTimers: params.useTimers,
        botsOnly: params.botsOnly ? true : undefined,
      },
      players: [],
      status: GameStatus.JOINING,
      createdBy: params.userId,
      nextPlayerToAct: null,
      nextPlayerActBy: null,
      auctionId: null,
      auctionSquareId: null,
      lottoId: null,
      results: null,
      messages: [],
      log: [],
      gameLength: null,
      winner: null,
      turnNumber: 0,
      createdAt: now,
      updatedAt: now,
    };

    await ctx.store.saveGame(newGame);

    return newGame;
  }

  public static async joinGame(
    ctx: GameContext,
    userId: string,
    selectedPiece: PieceType,
    selectedPlayerClass: PlayerClass,
    gamePwd: string | null
  ): Promise<{ errMsg: string; result: JoinResult | null }> {
    const errMsg = await GameProcessor.getJoinGameErrMsg(
      ctx,
      userId,
      selectedPiece,
      gamePwd
    );
    if (errMsg) {
      console.log("join error - %s", errMsg);
      return { errMsg, result: null };
    }

    const playerName: string = await GameProcessor.getUserName(ctx, userId);
    const game: GameInstanceDocument | null = await ctx.store.getGame();
    if (!game) {
      return { errMsg: "game not found", result: null };
    }

    const initialSkills: SkillSettings = Traits.getInitialSkills(
      selectedPlayerClass
    );

    const newPlayer: Player = {
      _id: userId,
      name: playerName,
      position: 1,
      money: 0,
      totalAssets: 0,
      mortgageableValue: 0,
      redeemableValue: 0,
      taxesPerTurn: 0,
      electricityCostsPerTurn: 0,
      taxTooltip: "",
      electricityTooltip: "",
      color: "#f58a42",
      type: selectedPiece,
      playerClass: selectedPlayerClass,
      state: PlayerState.ACTIVE,
      numAbilityPoints: 0,
      negotiation: initialSkills.negotiation,
      luck: initialSkills.luck,
      corruption: initialSkills.corruption,
      hasRolled: false,
      hasTraveled: false,
      canTravel: false,
      rollHistory: [],
      numTurnsInIsolation: 0,
      numTimeouts: 0,
    };

    game.players.push(newPlayer);

    if (game.players.length === game.settings.maxPlayers) {
      game.allJoined = true;
      await GameProcessor.initGame(ctx, game);
    }
    await ctx.store.saveGame(game);

    await PlayerProcessor.onJoinGame(ctx, userId, game);

    return {
      errMsg: "",
      result: {
        allJoined: game.allJoined,
        playerName: playerName,
      },
    };
  }

  /** Adds a computer player to a lobby; starts the game if that fills it. */
  public static async addBot(
    ctx: GameContext,
    level: BotLevel
  ): Promise<{ errMsg: string; result: JoinResult | null }> {
    const game = await ctx.store.getGame();
    if (!game) {
      return { errMsg: "game not found", result: null };
    }
    if (game.status !== GameStatus.JOINING || game.allJoined) {
      return { errMsg: "The game has already started", result: null };
    }
    if (game.players.length >= game.settings.maxPlayers) {
      return { errMsg: "The game is full", result: null };
    }

    const bot = createBotPlayer(game, level);
    game.players.push(bot);

    if (game.players.length === game.settings.maxPlayers) {
      game.allJoined = true;
      await GameProcessor.initGame(ctx, game);
    }
    await ctx.store.saveGame(game);

    return { errMsg: "", result: { allJoined: game.allJoined, playerName: bot.name } };
  }

  private static async initGame(
    ctx: GameContext,
    game: GameInstanceDocument
  ): Promise<void> {
    game.players = _.shuffle(game.players);

    for (let index = 0; index < game.players.length; index++) {
      const p = game.players[index];
      p.money = Math.round(game.settings.initialMoney);
      p.position = 1;
      p.color = player_colors[index];
      p.state = PlayerState.ACTIVE;
      p.hasRolled = false;
      p.numAbilityPoints = game.settings.initialSkillPoints;
      p.numTimeouts = 0;

      await PlayerProcessor.assignUserToGame(ctx, p._id, game);
    }

    game.nextPlayerToAct = game.players[0]._id;
    game.status = GameStatus.ACTIVE;

    if (game.settings.useTimers) {
      const now = new Date();
      const actBy = addSeconds(now, ctx.turnTimeLimit);
      game.nextPlayerActBy = formatISO(actBy);
    }

    if (ctx.devPreownProperties && game.players.length > 1) {
      // dev shortcut carried over from the original server: give the second
      // player every property so rent/tax paths are easy to exercise.
      // Opt in with DEV_PREOWN_PROPERTIES=true in worker/.dev.vars.
      for (let id = 1; id <= 38; id++) {
        GameProcessor.assignSquareTesting(game, game.players[1], id, 30);
      }
    }

    game.players.forEach((p) => {
      PlayerCostsCalculator.updatePlayerCosts(game, p);
    });
  }

  private static assignSquareTesting(
    game: GameInstanceDocument,
    owner: Player,
    squareId: number,
    purchasePrice: number
  ): void {
    const squareConfig = SquareConfigDataMap.get(squareId);
    if (
      !squareConfig ||
      (squareConfig.type !== SquareType.Property &&
        squareConfig.type !== SquareType.TrainStation &&
        squareConfig.type !== SquareType.Utility)
    ) {
      return;
    }

    const state: SquareGameData | undefined = game.squareState.find(
      (p: SquareGameData) => p.squareId === squareId
    );
    if (state && state.owner) {
      return;
    }

    if (state) {
      state.mortgageValue = MoneyCalculator.getMortgageValue(
        purchasePrice,
        squareConfig.type
      );
      state.purchasePrice = purchasePrice;
      state.color = owner.color!;
      state.owner = owner._id!;
    }
  }

  public static async getJoinGameErrMsg(
    ctx: GameContext,
    userId: string,
    selectedPiece: PieceType,
    gamePwd: string | null
  ): Promise<string> {
    const game: GameInstanceDocument | null = await ctx.store.getGame();

    if (game == null) {
      return "game not found";
    }

    if (game.allJoined) {
      return "all Joined already";
    }

    if (_.some(game.players, { type: selectedPiece })) {
      return "That piece is already taken";
    }

    if (game.players.some((p) => areIdsEqual(p._id, userId))) {
      return "This user has already joined this game";
    }

    if (game.settings.password && game.settings.password.length > 0) {
      if (!gamePwd || gamePwd.length === 0) {
        return "Invalid Password";
      }

      const isMatch = await verifyPassword(gamePwd, game.settings.password);
      if (!isMatch) {
        return "Invalid Password";
      }
    }

    return "";
  }

  private static async getUserName(
    ctx: GameContext,
    userId: string
  ): Promise<string> {
    const ud: UserDocument | null = await ctx.store.getUser(userId);
    if (ud) {
      return ud.username;
    }
    return "";
  }

  public static async leaveGame(
    ctx: GameContext,
    userId: string
  ): Promise<void> {
    const game: GameInstanceDocument | null = await ctx.store.getGame();
    if (game == null) {
      return;
    }

    const status: GameStatus = game.status;

    if (status === GameStatus.JOINING) {
      game.players = game.players.filter((p) => !areIdsEqual(p._id, userId));
      if (!game.players.some((p) => !p.isBot)) {
        // nobody human left in the lobby: the computer players leave too
        game.players = [];
      }
    } else if (status === GameStatus.ACTIVE) {
      await GameProcessor.bankruptPlayer(ctx, game, userId);
    }

    await ctx.store.saveGame(game);

    await PlayerProcessor.updateLossesAndLeaveGame(ctx, game, userId);
  }

  public static async resignGame(
    ctx: GameContext,
    userId: string
  ): Promise<void> {
    const game: GameInstanceDocument | null = await ctx.store.getGame();
    if (game == null) {
      return;
    }

    const status: GameStatus = game.status;

    if (status === GameStatus.ACTIVE) {
      await GameProcessor.bankruptPlayer(ctx, game, userId);
    }

    await ctx.store.saveGame(game);

    // the player chose to leave: stop sending them back into this game
    const user = await ctx.store.getUser(userId);
    if (user && areIdsEqual(user.currGameId, game._id)) {
      user.currGameId = undefined;
      user.currGameName = undefined;
      await ctx.store.saveUser(user);
    }
  }

  public static async bankruptPlayer(
    ctx: GameContext,
    game: GameInstanceDocument,
    userId: string | null
  ): Promise<void> {
    const numPlayersStillInIt = game.players.filter(
      (p) => p.state !== PlayerState.BANKRUPT
    ).length;

    const losser = game.players.find(
      (p) => p._id && areIdsEqual(p._id, userId)
    );

    if (!losser) {
      return;
    }

    if (losser.state === PlayerState.BANKRUPT) {
      return;
    }

    losser.state = PlayerState.BANKRUPT;
    losser.hasTraveled = true;
    losser.hasRolled = true;

    if (!losser.finishedRank) {
      losser.finishedRank = numPlayersStillInIt;
      await PlayerProcessor.updateLosses(ctx, game, losser._id);
    }

    game.squareState.forEach((s: SquareGameData) => {
      if (s.owner && areIdsEqual(s.owner, userId)) {
        s.numHouses = 0;
        s.owner = undefined;
        s.color = undefined;
        s.purchasePrice = undefined;
        s.mortgageValue = undefined;
        s.isMortgaged = false;
      }
    });

    PlayerCostsCalculator.updatePlayerCosts(game, losser);

    const isGameOver =
      game.players.filter((p) => p.state !== PlayerState.BANKRUPT).length === 1;
    if (isGameOver) {
      game.status = GameStatus.FINISHED;
      game.gameLength = differenceInMinutes(
        new Date(),
        parseISO(game.createdAt)
      );

      const winner = game.players.filter(
        (p) => p.state !== PlayerState.BANKRUPT
      )[0];
      if (winner) {
        winner.finishedRank = 1;
        await PlayerProcessor.updateWins(ctx, winner._id);

        game.winner = winner.name;
      }
    } else {
      const msg: ServerMsg = {
        title: "Elimination",
        body: losser.name + " has filed for bankruptcy protection",
      };

      ctx.events.send(GameEvent.SHOW_MSG_FROM_SERVER, msg);
    }

    if (game.nextPlayerToAct && !areIdsEqual(game.nextPlayerToAct, losser._id)) {
      return;
    }

    const nextPlayerId: string | null = RollProcessor.getNextPlayerToAct(
      game,
      losser
    );
    if (nextPlayerId) {
      game.nextPlayerToAct = nextPlayerId;

      // the turn passes to someone else, so give them a full turn's time
      if (game.settings.useTimers) {
        game.nextPlayerActBy = formatISO(addSeconds(new Date(), ctx.turnTimeLimit));
      }
    }

    const nextPlayer =
      nextPlayerId &&
      game.players.find((p) => p._id && areIdsEqual(p._id, nextPlayerId));

    if (nextPlayer) {
      MoneyCalculator.subtractElectricityAndTaxes(nextPlayer);
      PlayerCostsCalculator.updatePlayerCosts(game, nextPlayer);
    }
  }
}
