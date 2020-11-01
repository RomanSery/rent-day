/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { NextFunction, Request, Response } from "express";
import { createTestGame } from "../TestGameSetup";
import { check, validationResult } from "express-validator";
import { GameInstance } from "../../core/schema/GameInstanceSchema";
import { GameContext } from "../../core/types/GameContext";
import { PieceType } from "../../core/enums/PieceType";
import _ from "lodash";
import { Player } from "../../core/types/Player";

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
  });
};
