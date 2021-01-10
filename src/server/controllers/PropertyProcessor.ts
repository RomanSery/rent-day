import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { SquareGameData } from "../../core/types/SquareGameData";

export class PropertyProcessor {
  public static async mortgageProperty(
    squareId: number,
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<string> {
    const game: GameInstanceDocument | null = await GameInstance.findById(
      gameId
    );
    if (!game) {
      return "game not found";
    }

    if (game.squareState) {
      game.squareState = new Map<string, SquareGameData>();
    }

    const state: SquareGameData | undefined = game.squareState.get(
      squareId.toString()
    );

    if (!state) {
      return "property not owned";
    }

    if (state.isMortgaged) {
      return "property already mortgaged";
    }

    if (!userId.equals(new mongoose.Types.ObjectId(state.owner))) {
      return "you are not the owner";
    }

    state.isMortgaged = true;
    await game.save();
    return "";
  }

  public static async redeemProperty(
    squareId: number,
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<string> {
    const game: GameInstanceDocument | null = await GameInstance.findById(
      gameId
    );
    if (!game) {
      return "game not found";
    }

    if (game.squareState) {
      game.squareState = new Map<string, SquareGameData>();
    }

    const state: SquareGameData | undefined = game.squareState.get(
      squareId.toString()
    );

    if (!state) {
      return "property not owned";
    }

    if (!state.isMortgaged) {
      return "property not mortgaged";
    }

    if (!userId.equals(new mongoose.Types.ObjectId(state.owner))) {
      return "you are not the owner";
    }

    state.isMortgaged = false;
    await game.save();
    return "";
  }
}
