/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Request, Response } from "express";
import { check, validationResult } from "express-validator";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { GameToJoin } from "../../core/types/GameToJoin";
import _ from "lodash";
import { Player } from "../../core/types/Player";
import mongoose from "mongoose";
import { GameStatus } from "../../core/enums/GameStatus";
import { SquareThemeData } from "../../core/types/SquareThemeData";
import { NyThemeData } from "../../core/config/NyTheme";
import { PlayerState } from "../../core/enums/PlayerState";

export const createGame = async (req: Request, res: Response) => {
  await check("data.gameName", "GameId missing").notEmpty().run(req);
  await check("data.maxPlayers", "GameId missing").notEmpty().run(req);
  await check("data.initialMoney", "Name is not valid")
    .notEmpty()
    .isLength({ min: 4 })
    .isAlphanumeric()
    .run(req);

  const themeData = new Map<string, SquareThemeData>();
  NyThemeData.forEach((value: SquareThemeData, key: number) => {
    themeData.set(_.toString(key), value);
  });

  const gameName = req.body.data.gameName;
  const maxPlayers = req.body.data.maxPlayers;
  const initialMoney = req.body.data.initialMoney;

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

  return res.json({ gameId: newGame.id });
};

export const getGame = async (req: Request, res: Response) => {
  await check("gameId", "Please enter a valid gameId.").notEmpty().run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).send("missing gameId");
  }

  const gameId = req.body.gameId;

  const found = await GameInstance.findById(gameId, (err, existingGame) => {
    if (err) {
      return console.log(err);
    }
    return existingGame;
  });

  res.json({ game: found });
};

export const getGamesToJoin = async (req: Request, res: Response) => {
  GameInstance.find({ status: GameStatus.JOINING }, function (err, docs) {
    if (err) {
      return console.log(err);
    }

    const gamesToJoin: GameToJoin[] = [];

    for (let game of docs) {
      gamesToJoin.push({
        gameId: game._id,
        name: game.name,
        maxPlayers: game.settings.maxPlayers,
        playersJoined: game.players.length,
      });
    }

    res.json({ games: gamesToJoin });
  });
};

export const getGameStatus = async (req: Request, res: Response) => {
  await check("gameId", "Please enter a valid gameId.").notEmpty().run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).send("missing gameId");
  }

  const gameId = req.body.gameId;

  const found = await GameInstance.findById(gameId, (err, existingGame) => {
    if (err) {
      return console.log(err);
    }
    return existingGame;
  });

  const status: GameStatus | null = found != null ? found.status : null;
  res.json({ status: status });
};

export const joinGame = async (req: Request, res: Response) => {
  await check("gameId", "GameId missing").notEmpty().run(req);
  await check("name", "Name is not valid")
    .notEmpty()
    .isLength({ min: 4 })
    .isAlphanumeric()
    .run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send(errors);
  }

  const gameId = req.body.gameId;
  let existingGame = await GameInstance.findById(gameId);

  if (existingGame == null) {
    return res.status(400).send("game not found");
  }

  if (existingGame.allJoined) {
    return res.status(400).send("all Joined already");
  }

  const playerName = _.trim(req.body.name);
  const selectedPiece: number = parseInt(_.trim(req.body.piece));

  if (_.some(existingGame.players, { name: playerName })) {
    return res.status(400).send("That name is already taken");
  }

  if (_.some(existingGame.players, { piece: selectedPiece })) {
    return res.status(400).send("That piece is already taken");
  }

  const newPlayer = {
    name: playerName,
    position: 1,
    money: 2000,
    color: "#f58a42",
    type: selectedPiece,
    state: PlayerState.ACTIVE,
  };

  existingGame.players.push(newPlayer);

  if (existingGame.players.length === existingGame.settings.maxPlayers) {
    existingGame.allJoined = true;
    initGame(existingGame);
  }
  existingGame.save();

  const playerAdded: Player | undefined = existingGame.players.find(
    (p) => p.name === playerName
  );
  const playerAddedId = playerAdded != null ? playerAdded._id : "";

  res.json({
    status: "success",
    playerId: playerAddedId,
    allJoined: existingGame.allJoined,
    playerName: playerName,
  });
};

const initGame = (game: GameInstanceDocument) => {
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
};

export const leaveGame = async (req: Request, res: Response) => {
  await check("gameId", "GameId missing").notEmpty().run(req);
  await check("playerId", "playerId missing").notEmpty().run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send(errors);
  }

  const gameId = req.body.gameId;
  const playerId = req.body.playerId;
  let existingGame = await GameInstance.findById(gameId);

  if (existingGame == null) {
    return res.status(400).send("game not found");
  }

  const status: GameStatus = existingGame.status;

  if (status == GameStatus.JOINING) {
    existingGame.players = _.remove(existingGame.players, function (p) {
      return p._id === playerId;
    });
  } else if (status == GameStatus.ACTIVE) {
    //TODO do something else i think, not sure
    existingGame.players = _.remove(existingGame.players, function (p) {
      return p._id === playerId;
    });
  }

  if (existingGame.players.length == 0) {
    GameInstance.findByIdAndDelete(existingGame.id, function (err) {
      if (err) console.log(err);
    });
  } else {
    existingGame.save();
  }

  res.json({ status: "success" });
};
