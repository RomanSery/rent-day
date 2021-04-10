import mongoose, { Schema } from "mongoose";
import { GameStatus } from "../enums/GameStatus";
import { ChatMsg } from "../types/ChatMsg";
import { LastResult } from "../types/LastResult";
import { Player } from "../types/Player";
import { Settings } from "../types/Settings";
import { SquareGameData } from "../types/SquareGameData";
import { SquareThemeData } from "../types/SquareThemeData";

const PlayerSchema = new mongoose.Schema({
  _id: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  money: { type: Number, required: true },

  finishedRank: { type: Number },

  taxesPerTurn: { type: Number, required: true },
  electricityCostsPerTurn: { type: Number, required: true },
  taxTooltip: { type: String },
  electricityTooltip: { type: String },

  totalAssets: { type: Number, required: true },
  mortgageableValue: { type: Number, required: true },
  redeemableValue: { type: Number, required: true },

  position: { type: Number, required: true },
  color: { type: String, required: true },
  type: { type: String, required: true },
  playerClass: { type: String, required: true },
  state: { type: String, required: true },

  numAbilityPoints: { type: Number, required: true },
  negotiation: { type: Number, required: true },
  luck: { type: Number, required: true },
  corruption: { type: Number, required: true },

  hasRolled: { type: Boolean, required: true },
  hasTraveled: { type: Boolean, required: true },
  canTravel: { type: Boolean, required: true },
  rollHistory: { type: Schema.Types.Array },
  numTurnsInIsolation: { type: Number, required: true },
});

const SquareGameDataSchema = new mongoose.Schema({
  squareId: { type: Number, required: true },
  owner: { type: String },
  color: { type: String },
  numHouses: { type: Number, required: true },
  isMortgaged: { type: Boolean, required: true },
  purchasePrice: { type: Number },
  mortgageValue: { type: Number },

  houseCost: { type: Number },
  electricityCost: { type: Number },
  tax: { type: Number },
  rent0: { type: Number },
  rent1: { type: Number },
  rent2: { type: Number },
  rent3: { type: Number },
  rent4: { type: Number },
  rent5: { type: Number },
});

const SettingsSchema = new mongoose.Schema({
  initialMoney: { type: Number, required: true },
  initialSkillPoints: { type: Number, required: true },
  maxPlayers: { type: Number, required: true },
  password: { type: String, required: false },
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
  lottoId: mongoose.Types.ObjectId | null;
  allJoined: boolean;
  status: GameStatus;
  results: LastResult;
  createdBy: mongoose.Types.ObjectId;
  messages: ChatMsg[];
  log: ChatMsg[];
  gameLength: number | null;
  winner: string | null;
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
    lottoId: mongoose.Types.ObjectId,
    allJoined: Boolean,
    status: String,
    results: Schema.Types.Mixed,
    createdBy: mongoose.Types.ObjectId,
    messages: [Schema.Types.Mixed],
    log: [Schema.Types.Mixed],
    gameLength: Number,
    winner: String,
  },
  { timestamps: true }
);

export const GameInstance = mongoose.model<GameInstanceDocument>(
  "games",
  gameInstanceSchema
);
