import mongoose from "mongoose";
import { GameInstance } from "../core/schema/GameInstanceSchema";
import { NyThemeData } from "../core/config/NyTheme";
import _ from "lodash";
import { SquareThemeData } from "../core/types/SquareThemeData";
import { GameContext } from "../core/types/GameContext";
import { PieceType } from "../core/enums/PieceType";

export const createTestGame = async (): Promise<GameContext> => {
  const pos: number = 1;

  const player1 = {
    name: "roman",
    position: pos,
    money: 2000,
    color: "#3d4feb",
    type: PieceType.Pawn,
  };
  const player2 = {
    name: "igor",
    position: pos,
    money: 2000,
    color: "#0ea706",
    type: PieceType.Hat,
  };
  const player3 = {
    name: "steve",
    position: pos,
    money: 2000,
    color: "#42f5e3",
    type: PieceType.Car,
  };
  const player4 = {
    name: "alex",
    position: pos,
    money: 2000,
    color: "#f542b3",
    type: PieceType.Bicycle,
  };
  const player5 = {
    name: "vlad",
    position: pos,
    money: 2000,
    color: "#c8f542",
    type: PieceType.Cat,
  };
  const player6 = {
    name: "zak",
    position: pos,
    money: 2000,
    color: "#f58a42",
    type: PieceType.Dog,
  };

  const themeData = new Map<string, SquareThemeData>();

  await GameInstance.deleteMany({});

  NyThemeData.forEach((value: SquareThemeData, key: number) => {
    themeData.set(_.toString(key), value);
  });

  const testGame = new GameInstance({
    name: "test game",
    theme: themeData,
    players: [player1, player2, player3, player4, player5, player6],
    numPlayers: 2,
  });
  /*players: [player1, player2, player3, player4, player5, player6],*/

  await testGame.save();

  testGame.nextPlayerToAct = mongoose.Types.ObjectId(testGame.players[0]._id);

  await testGame.save();

  return { gameId: testGame.id, playerId: testGame.players[0]._id };
  //return { gameId: testGame.id, playerId: "12321" };
};
