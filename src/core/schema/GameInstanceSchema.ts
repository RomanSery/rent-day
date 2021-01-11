import mongoose, { Schema } from "mongoose";
import { GameStatus } from "../enums/GameStatus";
import { LastResult } from "../types/LastResult";
import { Player } from "../types/Player";
import { Settings } from "../types/Settings";
import { SquareGameData } from "../types/SquareGameData";
import { SquareThemeData } from "../types/SquareThemeData";

const PlayerSchema = new mongoose.Schema({
  _id: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  money: { type: Number, required: true },
  position: { type: Number, required: true },
  color: { type: String, required: true },
  type: { type: String, required: true },
  playerClass: { type: String, required: true },
  state: { type: String, required: true },

  negotiation: { type: Number, required: true },
  speed: { type: Number, required: true },
  intelligence: { type: Number, required: true },

  hasRolled: { type: Boolean, required: true },
  lastRoll: { type: Schema.Types.Mixed },
  secondRoll: { type: Schema.Types.Mixed },
  thirdRoll: { type: Schema.Types.Mixed },
});

const SquareGameDataSchema = new mongoose.Schema({
  squareId: { type: Number, required: true },
  owner: { type: String, required: true },
  color: { type: String, required: true },
  numHouses: { type: Number, required: true },
  isMortgaged: { type: Boolean, required: true },
  purchasePrice: { type: Number },
  mortgageValue: { type: Number },
});

const SettingsSchema = new mongoose.Schema({
  initialMoney: { type: Number, required: true },
  maxPlayers: { type: Number, required: true },
});

export type GameInstanceDocument = mongoose.Document & {
  name: string;
  players: Player[];
  settings: Settings;
  theme: Map<string, SquareThemeData>;
  squareState: SquareGameData[];
  nextPlayerToAct: mongoose.Types.ObjectId;
  auctionId: mongoose.Types.ObjectId | null;
  auctionSquareId: number | null;
  treasureId: mongoose.Types.ObjectId | null;
  allJoined: boolean;
  status: GameStatus;
  results: LastResult;
  createdBy: mongoose.Types.ObjectId;
};

const gameInstanceSchema = new mongoose.Schema(
  {
    name: String,
    players: [PlayerSchema],
    settings: SettingsSchema,
    theme: Map,
    squareState: [SquareGameDataSchema],
    nextPlayerToAct: mongoose.Types.ObjectId,
    auctionId: mongoose.Types.ObjectId,
    auctionSquareId: Number,
    treasureId: mongoose.Types.ObjectId,
    allJoined: Boolean,
    status: String,
    results: Schema.Types.Mixed,
    createdBy: mongoose.Types.ObjectId,
  },
  { timestamps: true }
);

export const GameInstance = mongoose.model<GameInstanceDocument>(
  "games",
  gameInstanceSchema
);
