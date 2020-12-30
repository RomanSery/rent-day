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

export class GameProcessor {
  public async createGame(
    gameName: string,
    maxPlayers: number,
    initialMoney: number
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
    });

    await newGame.save();

    return newGame.id;
  }

  public async joinGame(
    gameId: string,
    playerName: string,
    selectedPiece: number,
    selectedPlayerClass: number
  ): Promise<JoinResult | null> {
    const errMsg = await this.getJoinGameErrMsg(
      gameId,
      playerName,
      selectedPiece
    );
    if (errMsg) {
      console.log("join error - %s", errMsg);
      return null;
    }

    let game = await GameInstance.findById(gameId);

    const newPlayer = {
      name: playerName,
      position: 1,
      money: 2000,
      color: "#f58a42",
      type: selectedPiece,
      playerClass: selectedPlayerClass,
      state: PlayerState.ACTIVE,
      negotiation: 2,
      speed: 3,
      intelligence: 4,
    };

    game.players.push(newPlayer);

    if (game.players.length === game.settings.maxPlayers) {
      game.allJoined = true;
      this.initGame(game);
    }
    game.save();

    const playerAdded: Player | undefined = game.players.find(
      (p: Player) => p.name === playerName
    );
    const playerAddedId: string = playerAdded ? playerAdded._id! : "";

    return {
      playerId: playerAddedId,
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
    });

    game.nextPlayerToAct = mongoose.Types.ObjectId(game.players[0]._id);
    game.status = GameStatus.ACTIVE;
  }

  public async getJoinGameErrMsg(
    gameId: string,
    playerName: string,
    selectedPiece: number
  ): Promise<string> {
    const game = await GameInstance.findById(gameId);

    if (game == null) {
      return "game not found";
    }

    if (game.allJoined) {
      return "all Joined already";
    }

    if (_.some(game.players, { name: playerName })) {
      return "That name is already taken";
    }

    if (_.some(game.players, { type: selectedPiece })) {
      return "That piece is already taken";
    }

    return "";
  }

  public async getGame(gameId: string): Promise<GameInstanceDocument> {
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

  public async getGameStatus(gameId: string): Promise<GameStatus | null> {
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

  public async leaveGame(gameId: string, playerId: string): Promise<void> {
    let game = await GameInstance.findById(gameId);
    if (game == null) {
      return;
    }

    const status: GameStatus = game.status;

    if (status == GameStatus.JOINING) {
      for (let i = 0; i < game.players.length; i++) {
        if (game.players[i]._id == playerId) {
          game.players.splice(i, 1);
        }
      }
    } else if (status == GameStatus.ACTIVE) {
      //TODO do something else i think, not sure
      for (let i = 0; i < game.players.length; i++) {
        if (game.players[i]._id == playerId) {
          game.players.splice(i, 1);
        }
      }
    }

    /*
    if (game.players.length == 0) {
      GameInstance.findByIdAndDelete(game.id, function (err) {
        if (err) console.log(err);
      });
    } else {
      game.save();
    }*/
    game.save();
  }
}
