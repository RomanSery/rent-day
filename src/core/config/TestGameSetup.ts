import { GameInstance } from "../schema/GameInstanceSchema";
import { NyThemeData } from "./NyTheme";

export const createTestGame = async () => {
  const player1 = { name: "roman", position: 0, money: 2000 };
  const player2 = { name: "igor", position: 0, money: 2000 };

  const testGame = new GameInstance({
    name: "test game",
    players: [player1, player2],
  });

  console.log(testGame);

  await GameInstance.deleteMany({});

  testGame.save((err) => {
    if (err) {
      console.log(err);
      //return next(err);
    }
    console.log(testGame.id);
  });
};
