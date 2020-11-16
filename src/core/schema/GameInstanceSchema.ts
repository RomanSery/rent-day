import mongoose from "mongoose";
import { GameStatus } from "../enums/GameStatus";
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
  numPlayers: number;
  allJoined: boolean;
  status: GameStatus;
};

const gameInstanceSchema = new mongoose.Schema(
  {
    name: String,
    players: [PlayerSchema],
    settings: SettingsSchema,
    theme: Map,
    nextPlayerToAct: mongoose.Types.ObjectId,
    numPlayers: Number,
    allJoined: Boolean,
    status: String,
  },
  { timestamps: true }
);

export const GameInstance = mongoose.model<GameInstanceDocument>(
  "games",
  gameInstanceSchema
);
