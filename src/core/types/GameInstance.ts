import mongoose from "mongoose";

export type GameInstanceDocument = mongoose.Document & {
  id: string;
  name: string;
};

const gameInstanceSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    name: String,
  },
  { timestamps: true }
);

export const GameInstance = mongoose.model<GameInstanceDocument>(
  "games",
  gameInstanceSchema
);
