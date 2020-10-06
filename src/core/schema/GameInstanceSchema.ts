import mongoose from "mongoose";
import { Player } from "../types/Player";
import { SquareThemeData } from "../types/SquareThemeData";
import { PlayerSchema } from "./PlayerSchema";

export type GameInstanceDocument = mongoose.Document & {
  name: string;
  players: Player[];
  theme: Map<number, SquareThemeData>;
};

const gameInstanceSchema = new mongoose.Schema(
  {
    name: String,
    players: [PlayerSchema],
    theme: Map,
  },
  { timestamps: true }
);

export const GameInstance = mongoose.model<GameInstanceDocument>(
  "games",
  gameInstanceSchema
);
