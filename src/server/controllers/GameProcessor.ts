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

export class GameProcessor {
  public async createGame(
    gameName: string,
    maxPlayers: number,
    initialMoney: number,
    userId: mongoose.Types.ObjectId
  ): Promise<number> {
    const themeData = new Map<string, SquareThemeData>();
    NyThemeData.forEach((value: SquareThemeData, key: number) => {
      themeData.set(_.toString(key), value);
    });

    const newGame = new GameInstance({
      name: gameName,
      theme: themeData,
      allJoined: false,
      maxPlayers: maxPlayers,
      settings: { initialMoney: initialMoney, maxPlayers: maxPlayers },
      players: [],
      status: GameStatus.JOINING,
      createdBy: userId,
    });

    await newGame.save();
    return newGame.id;
  }

  public async joinGame(
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    selectedPiece: PieceType,
    selectedPlayerClass: PlayerClass
  ): Promise<JoinResult | null> {
    const errMsg = await this.getJoinGameErrMsg(gameId, userId, selectedPiece);
    if (errMsg) {
      console.log("join error - %s", errMsg);
      return null;
    }

    const playerName: string = await this.getUserName(userId);
    let game: GameInstanceDocument = await GameInstance.findById(gameId);

    const newPlayer: Player = {
      _id: userId.toHexString(),
      name: playerName,
      position: 1,
      money: 0,
      color: "#f58a42",
      type: selectedPiece,
      playerClass: selectedPlayerClass,
      state: PlayerState.ACTIVE,
      negotiation: 2,
      speed: 3,
      intelligence: 4,
      hasRolled: false,
    };

    game.players.push(newPlayer);

    if (game.players.length === game.settings.maxPlayers) {
      game.allJoined = true;
      this.initGame(game);
    }
    game.save();

    return {
      allJoined: game.allJoined,
      playerName: playerName,
    };
  }

  private initGame(game: GameInstanceDocument): void {
    game.players = _.shuffle(game.players);

    const colors = [
      "#3d4feb",
      "#0ea706",
      "#42f5e3",
      "#f542b3",
      "#c8f542",
      "#f58a42",
    ];

    _.forEach(game.players, function (p, index) {
      p.money = game.settings.initialMoney;
      p.position = 1;
      p.color = colors[index];
      p.state = PlayerState.ACTIVE;
      p.hasRolled = false;
    });

    game.nextPlayerToAct = new mongoose.Types.ObjectId(game.players[0]._id);
    game.status = GameStatus.ACTIVE;
  }

  public async getJoinGameErrMsg(
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    selectedPiece: PieceType
  ): Promise<string> {
    const game: GameInstanceDocument = await GameInstance.findById(gameId);

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

    return "";
  }

  public async getGame(
    gameId: mongoose.Types.ObjectId
  ): Promise<GameInstanceDocument> {
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
    const ud: UserDocument = await UserInstance.findById(
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

  public async getGameStatus(
    gameId: mongoose.Types.ObjectId
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

        for (let game of docs) {
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
    let game: GameInstanceDocument = await GameInstance.findById(gameId);
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
      //TODO do something else i think, not sure
      for (let i = 0; i < game.players.length; i++) {
        if (new mongoose.Types.ObjectId(game.players[i]._id).equals(userId)) {
          game.players.splice(i, 1);
        }
      }
    }

    game.save();
  }
}
