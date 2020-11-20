import { GameInstance } from "../core/schema/GameInstanceSchema";
import { NyThemeData } from "../core/config/NyTheme";
import _ from "lodash";
import { SquareThemeData } from "../core/types/SquareThemeData";
import { GameContext } from "../core/types/GameContext";
import { PieceType } from "../core/enums/PieceType";
import { GameStatus } from "../core/enums/GameStatus";

export const createTestGame = async (): Promise<GameContext> => {
  const player3 = {
    name: "steve",
    type: PieceType.Car,
    color: "#000000",
    position: 1,
    money: 0,
  };
  const player4 = {
    name: "alex",
    type: PieceType.Bicycle,
    color: "#000000",
    position: 1,
    money: 0,
  };
  const player5 = {
    name: "vlad",
    type: PieceType.Cat,
    color: "#000000",
    position: 1,
    money: 0,
  };

  const themeData = new Map<string, SquareThemeData>();

  await GameInstance.deleteMany({});

  NyThemeData.forEach((value: SquareThemeData, key: number) => {
    themeData.set(_.toString(key), value);
  });

  const testGame = new GameInstance({
    name: "test game",
    theme: themeData,
    numPlayers: 6,
    allJoined: false,
    settings: { initialMoney: 2000, numPlayers: 5 },
    players: [player3, player4, player5],
    status: GameStatus.JOINING,
  });

  await testGame.save();

  return { gameId: testGame.id, playerId: "" };
};
