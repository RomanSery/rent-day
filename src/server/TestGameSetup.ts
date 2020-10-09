import mongoose from "mongoose";
import { GameInstance } from "../core/schema/GameInstanceSchema";
import { NyThemeData } from "../core/config/NyTheme";
import _ from "lodash";
import { SquareThemeData } from "../core/types/SquareThemeData";
import { GameContext } from "../core/types/GameContext";

export const createTestGame = async (): Promise<GameContext> => {
  const player1 = { name: "roman", position: 0, money: 2000, color: "#3d4feb" };
  const player2 = { name: "igor", position: 0, money: 2000, color: "#0ea706" };

  const themeData = new Map<string, SquareThemeData>();

  await GameInstance.deleteMany({});

  NyThemeData.forEach((value: SquareThemeData, key: number) => {
    themeData.set(_.toString(key), value);
  });

  const testGame = new GameInstance({
    name: "test game",
    players: [player1, player2],
    theme: themeData,
  });

  await testGame.save();

  testGame.nextPlayerToAct = mongoose.Types.ObjectId(testGame.players[0].id);

  await testGame.save();

  return { gameId: testGame.id, playerId: testGame.players[0].id };
};
