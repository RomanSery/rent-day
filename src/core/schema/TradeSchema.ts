import mongoose, { Schema } from "mongoose";
import { TradeParticipant } from "../types/TradeParticipant";

const TradeParticipantSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  playerName: { type: String, required: true },
  playerColor: { type: String, required: true },
  amountGiven: { type: Number, required: true },
  squaresGiven: { type: Schema.Types.Array },
});

export type TradeDocument = mongoose.Document & {
  gameId: mongoose.Types.ObjectId;
  participant1: TradeParticipant;
  participant2: TradeParticipant;
  accepted: boolean;
};

const tradeSchema = new mongoose.Schema(
  {
    gameId: mongoose.Types.ObjectId,
    participant1: TradeParticipantSchema,
    participant2: TradeParticipantSchema,
    accepted: Boolean,
  },
  { timestamps: true }
);

export const Trade = mongoose.model<TradeDocument>("trades", tradeSchema);
