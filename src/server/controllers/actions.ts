/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { NextFunction, Request, Response } from "express";
import { createTestGame } from "../TestGameSetup";
import { check, validationResult } from "express-validator";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { GameContext } from "../../core/types/GameContext";
import { GameToJoin } from "../../core/types/GameToJoin";
import _ from "lodash";
import { Player } from "../../core/types/Player";
import mongoose from "mongoose";
import { GameStatus } from "../../core/enums/GameStatus";

export const initTestGame = async (req: Request, res: Response) => {
  const testGame: GameContext = await createTestGame();
  res.json(testGame);
};

export const getGame = async (req: Request, res: Response) => {
  await check("gameId", "Please enter a valid gameId.").notEmpty().run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.json({ err: "missing gameId" });
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
        numPlayers: game.numPlayers,
      });
    }

    res.json({ games: gamesToJoin });
  });
};

export const getGameStatus = async (req: Request, res: Response) => {
  await check("gameId", "Please enter a valid gameId.").notEmpty().run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.json({ err: "missing gameId" });
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
    return res.json({ errors: errors, status: "err" });
  }

  const gameId = req.body.gameId;
  let existingGame = await GameInstance.findById(gameId);

  if (existingGame == null) {
    return res.json({ errors: "game not found", status: "err" });
  }

  if (existingGame.allJoined) {
    return res.json({ errors: "allJoined already", status: "err" });
  }

  const playerName = _.trim(req.body.name);
  if (_.some(existingGame.players, { name: playerName })) {
    return res.json({ errors: "That name is already taken", status: "err" });
  }

  const newPlayer = {
    name: playerName,
    position: 1,
    money: 2000,
    color: "#f58a42",
    type: req.body.piece,
  };

  existingGame.players.push(newPlayer);

  if (existingGame.players.length === existingGame.numPlayers) {
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

  _.forEach(game.players, function (p) {
    p.money = game.settings.initialMoney;
    p.position = 1;
    p.color = colors[_.random(0, colors.length)];
  });

  game.nextPlayerToAct = mongoose.Types.ObjectId(game.players[0]._id);
  game.status = GameStatus.ACTIVE;
};
