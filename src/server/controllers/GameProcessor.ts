import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { SquareThemeData } from "../../core/types/SquareThemeData";
import { NyThemeData } from "../../core/config/NyTheme";
import _ from "lodash";
import { GameStatus } from "../../core/enums/GameStatus";
import mongoose from "mongoose";
import { GameToJoin } from "../../core/types/GameToJoin";
import { PlayerState } from "../../core/enums/PlayerState";
import { JoinResult } from "../../core/types/JoinResult";
import { Player } from "../../core/types/Player";
import { UserDocument, UserInstance } from "../../core/schema/UserSchema";
import { PieceType } from "../../core/enums/PieceType";
import { PlayerClass } from "../../core/enums/PlayerClass";
import { SquareGameData } from "../../core/types/SquareGameData";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareConfigData } from "../../core/types/SquareConfigData";
import { ServerMsg } from "../../core/types/ServerMsg";
import { player_colors, turnTimeLimit } from "../../core/constants";
import { MoneyCalculator } from "./MoneyCalculator";
import { Traits } from "../traits/Traits";
import { SkillSettings } from "../../core/types/SkillSettings";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";
import { RollProcessor } from "./RollProcessor";
import { PlayerProcessor } from "./PlayerProcessor";
import bcrypt from "bcrypt-nodejs";
import { SquareType } from "../../core/enums/SquareType";
import { IS_DEV } from "../util/secrets";
import {
  addSeconds,
  differenceInDays,
  differenceInMinutes,
  formatISO,
} from "date-fns";
import { gameServer } from "../index";
import { GameEvent } from "../../core/types/GameEvent";

export class GameProcessor {
  public async createGame(
    gameName: string,
    maxPlayers: number,
    initialMoney: number,
    initialSkillPoints: number,
    userId: mongoose.Types.ObjectId,
    password: string | null
  ): Promise<number> {
    const themeData = new Map<string, SquareThemeData>();
    NyThemeData.forEach((value: SquareThemeData, key: number) => {
      themeData.set(_.toString(key), value);
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

    const newGame = new GameInstance({
      name: gameName,
      theme: themeData,
      squareState: squareState,
      allJoined: false,
      maxPlayers: maxPlayers,
      settings: {
        initialMoney: initialMoney,
        initialSkillPoints: initialSkillPoints,
        maxPlayers: maxPlayers,
        password: password,
      },
      players: [],
      status: GameStatus.JOINING,
      createdBy: userId,
    });

    if (password && password.length > 0) {
      bcrypt.genSalt(2, (err, salt) => {
        bcrypt.hash(password, salt, null, (err: mongoose.Error, hash) => {
          newGame.settings.password = hash;
        });
      });
    }

    await newGame.save();

    return newGame.id;
  }

  public async joinGame(
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    selectedPiece: PieceType,
    selectedPlayerClass: PlayerClass,
    gamePwd: string | null
  ): Promise<JoinResult | null> {
    const errMsg = await this.getJoinGameErrMsg(
      gameId,
      userId,
      selectedPiece,
      gamePwd
    );
    if (errMsg) {
      console.log("join error - %s", errMsg);
      return null;
    }

    const playerName: string = await this.getUserName(userId);
    let game: GameInstanceDocument | null = await GameInstance.findById(gameId);
    if (!game) {
      return null;
    }

    const initialSkills: SkillSettings = Traits.getInitialSkills(
      selectedPlayerClass
    );

    const newPlayer: Player = {
      _id: userId.toHexString(),
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
    };

    game.players.push(newPlayer);

    if (game.players.length === game.settings.maxPlayers) {
      game.allJoined = true;
      this.initGame(game);
    }
    game.save();

    await PlayerProcessor.onJoinGame(userId.toHexString(), game);

    return {
      allJoined: game.allJoined,
      playerName: playerName,
    };
  }

  private initGame(game: GameInstanceDocument): void {
    game.players = _.shuffle(game.players);

    game.players.forEach(async (p, index) => {
      p.money = Math.round(game.settings.initialMoney);
      p.position = 1;
      p.color = player_colors[index];
      p.state = PlayerState.ACTIVE;
      p.hasRolled = false;
      p.numAbilityPoints = game.settings.initialSkillPoints;

      await PlayerProcessor.assignUserToGame(p._id, game);
    });

    game.nextPlayerToAct = new mongoose.Types.ObjectId(game.players[0]._id);
    game.status = GameStatus.ACTIVE;

    const now = new Date();
    const actBy = addSeconds(now, turnTimeLimit);
    game.nextPlayerActBy = formatISO(actBy);

    if (IS_DEV) {
      for (let id = 1; id <= 38; id++) {
        //GameProcessor.assignSquareTesting(game, game.players[1], id, 30);
      }
    }

    game.players.forEach(async (p, index) => {
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

  public async getJoinGameErrMsg(
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    selectedPiece: PieceType,
    gamePwd: string | null
  ): Promise<string> {
    const game: GameInstanceDocument | null = await GameInstance.findById(
      gameId
    );

    if (game == null) {
      return "game not found";
    }

    if (game.allJoined) {
      return "all Joined already";
    }

    if (_.some(game.players, { type: selectedPiece })) {
      return "That piece is already taken";
    }

    if (_.some(game.players, { _id: userId })) {
      return "This user has already joined this game";
    }

    if (game.settings.password && game.settings.password.length > 0) {
      if (!gamePwd || gamePwd.length === 0) {
        return "Invalid Password";
      }

      const isMatch = bcrypt.compareSync(gamePwd, game.settings.password);
      if (!isMatch) {
        return "Invalid Password";
      }
    }

    return "";
  }

  public static async getGame(
    gameId: mongoose.Types.ObjectId
  ): Promise<GameInstanceDocument | null> {
    return await GameInstance.findById(
      gameId,
      (err: mongoose.CallbackError, existingGame: GameInstanceDocument) => {
        if (err) {
          return console.log(err);
        }
        return existingGame;
      }
    );
  }

  private async getUserName(userId: mongoose.Types.ObjectId): Promise<string> {
    const ud: UserDocument | null = await UserInstance.findById(
      userId,
      (err: mongoose.CallbackError, u: UserDocument) => {
        if (err) {
          return console.log(err);
        }
        return u;
      }
    );
    if (ud) {
      return ud.username;
    }
    return "";
  }

  public static async getGameStatus(
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<GameStatus | null> {
    const found = await GameInstance.findById(
      gameId,
      (err: mongoose.CallbackError, existingGame: GameInstanceDocument) => {
        if (err) {
          return console.log(err);
        }
        return existingGame;
      }
    );

    const status: GameStatus | null = found != null ? found.status : null;
    if (!found || !status || status === GameStatus.FINISHED) {
      const foundUser = await UserInstance.findById(
        userId,
        (err: mongoose.CallbackError, existingUser: UserDocument) => {
          if (err) {
            return console.log(err);
          }
          return existingUser;
        }
      );

      if (
        gameId &&
        foundUser &&
        foundUser.currGameId &&
        new mongoose.Types.ObjectId(gameId).equals(
          new mongoose.Types.ObjectId(foundUser.currGameId)
        )
      ) {
        foundUser.currGameId = undefined;
        foundUser.currGameName = undefined;
        await foundUser.save();
      }
    }

    return status;
  }

  public async getGamesToJoin(): Promise<GameToJoin[]> {
    const gamesToJoin: GameToJoin[] = [];

    await GameInstance.find(
      { status: GameStatus.JOINING },
      function (err, docs) {
        if (err) {
          return console.log(err);
        }

        const now = new Date();

        for (let game of docs) {
          if (differenceInDays(now, game._id.getTimestamp()) > 1) {
            continue;
          }

          gamesToJoin.push({
            gameId: game._id,
            name: game.name,
            maxPlayers: game.settings.maxPlayers,
            playersJoined: game.players.length,
          });
        }
      }
    );

    return gamesToJoin;
  }

  public async leaveGame(
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<void> {
    let game: GameInstanceDocument | null = await GameInstance.findById(gameId);
    if (game == null) {
      return;
    }

    const status: GameStatus = game.status;

    if (status === GameStatus.JOINING) {
      for (let i = 0; i < game.players.length; i++) {
        if (new mongoose.Types.ObjectId(game.players[i]._id).equals(userId)) {
          game.players.splice(i, 1);
        }
      }
    } else if (status === GameStatus.ACTIVE) {
      await GameProcessor.bankruptPlayer(game, userId);
    }

    game.save();

    await PlayerProcessor.updateLossesAndLeaveGame(game, userId);
  }

  public static async bankruptPlayer(
    game: GameInstanceDocument,
    userId: mongoose.Types.ObjectId
  ): Promise<void> {
    const numPlayersStillInIt = game.players.filter(
      (p) => p.state !== PlayerState.BANKRUPT
    ).length;

    const losser = game.players.find(
      (p) =>
        p._id &&
        new mongoose.Types.ObjectId(p._id).equals(
          new mongoose.Types.ObjectId(userId)
        )
    );

    if (!losser) {
      return;
    }

    losser.state = PlayerState.BANKRUPT;
    losser.hasTraveled = true;
    losser.hasRolled = true;

    if (!losser.finishedRank) {
      losser.finishedRank = numPlayersStillInIt;
      await PlayerProcessor.updateLosses(game, userId);
    }

    game.squareState.forEach((s: SquareGameData) => {
      if (s.owner && new mongoose.Types.ObjectId(s.owner).equals(userId)) {
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
        game._id.getTimestamp()
      );

      const winner = game.players.filter(
        (p) => p.state !== PlayerState.BANKRUPT
      )[0];
      if (winner) {
        winner.finishedRank = 1;
        await PlayerProcessor.updateWins(
          new mongoose.Types.ObjectId(winner._id)
        );

        game.winner = winner.name;
      }
    } else {
      const msg: ServerMsg = {
        title: "Elimination",
        body: losser.name + " has filed for bankruptcy protection",
      };

      gameServer.sendEventToGameClients(
        game.id,
        GameEvent.SHOW_MSG_FROM_SERVER,
        msg
      );
    }

    if (
      game.nextPlayerToAct &&
      !game.nextPlayerToAct.equals(new mongoose.Types.ObjectId(losser._id))
    ) {
      return;
    }

    const nextPlayerId: mongoose.Types.ObjectId | null = RollProcessor.getNextPlayerToAct(
      game,
      losser
    );
    if (nextPlayerId) {
      game.nextPlayerToAct = nextPlayerId;
    }

    const nextPlayer =
      nextPlayerId &&
      game.players.find(
        (p) => p._id && new mongoose.Types.ObjectId(p._id).equals(nextPlayerId)
      );

    if (nextPlayer) {
      MoneyCalculator.subtractElectricityAndTaxes(nextPlayer);
      PlayerCostsCalculator.updatePlayerCosts(game, nextPlayer);
    }
  }
}
