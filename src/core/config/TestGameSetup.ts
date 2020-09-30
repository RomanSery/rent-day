import { GameInstance } from "../schema/GameInstanceSchema";
import { NyThemeData } from "./NyTheme";
import _ from "lodash";
import { SquareThemeData } from "../types/SquareThemeData";

export const createTestGame = async () => {
  const player1 = { name: "roman", position: 0, money: 2000 };
  const player2 = { name: "igor", position: 0, money: 2000 };

  const themeData = new Map<string, SquareThemeData>();
  NyThemeData.forEach((value: SquareThemeData, key: number) => {
    themeData.set(_.toString(key), value);
  });

  const testGame = new GameInstance({
    name: "test game",
    players: [player1, player2],
    theme: themeData,
  });

  await GameInstance.deleteMany({});

  testGame.save((err) => {
    if (err) {
      console.log(err);
    }
    console.log(testGame.id);
  });
};
