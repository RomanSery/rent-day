import { GameInstance } from "../core/schema/GameInstanceSchema";
import { NyThemeData } from "../core/config/NyTheme";
import _ from "lodash";
import { SquareThemeData } from "../core/types/SquareThemeData";

export const createTestGame = async () => {
  const player1 = { name: "roman", position: 0, money: 2000 };
  const player2 = { name: "igor", position: 0, money: 2000 };

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

  return testGame.id;
};
