import mongoose, { Schema } from "mongoose";
import { GameStatus } from "../enums/GameStatus";
import { LastResult } from "../types/LastResult";
import { Player } from "../types/Player";
import { Settings } from "../types/Settings";
import { SquareThemeData } from "../types/SquareThemeData";
import { PlayerSchema } from "./PlayerSchema";
import { SettingsSchema } from "./SettingsSchema";

export type GameInstanceDocument = mongoose.Document & {
  name: string;
  players: Player[];
  settings: Settings;
  theme: Map<number, SquareThemeData>;
  nextPlayerToAct: mongoose.Types.ObjectId;
  allJoined: boolean;
  status: GameStatus;
  results: LastResult;
};

const gameInstanceSchema = new mongoose.Schema(
  {
    name: String,
    players: [PlayerSchema],
    settings: SettingsSchema,
    theme: Map,
    nextPlayerToAct: mongoose.Types.ObjectId,
    allJoined: Boolean,
    status: String,
    results: Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const GameInstance = mongoose.model<GameInstanceDocument>(
  "games",
  gameInstanceSchema
);
