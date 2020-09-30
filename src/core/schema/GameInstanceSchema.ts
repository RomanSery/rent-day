import mongoose from "mongoose";
import { PlayerSchema } from "./PlayerSchema";

export type GameInstanceDocument = mongoose.Document & {
  name: string;
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
