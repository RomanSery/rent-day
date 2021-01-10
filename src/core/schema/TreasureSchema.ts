import mongoose from "mongoose";

export type TreasureDocument = mongoose.Document & {
  gameId: mongoose.Types.ObjectId;
  playerId: mongoose.Types.ObjectId;
  playerName: string;
  playerColor: string;

  option1Amount: number;
  option1Percent: number;

  option2Amount: number;
  option2Percent: number;

  option3Amount: number;
  option3Percent: number;

  optionPicked: number;
  randomNum: number;

  prize: number;
};

const treasureSchema = new mongoose.Schema(
  {
    gameId: mongoose.Types.ObjectId,
    playerId: mongoose.Types.ObjectId,
    playerName: String,
    playerColor: String,
    option1Amount: Number,
    option1Percent: Number,
    option2Amount: Number,
    option2Percent: Number,
    option3Amount: Number,
    option3Percent: Number,
    optionPicked: Number,
    randomNum: Number,
    prize: Number,
  },
  { timestamps: true }
);

export const Treasure = mongoose.model<TreasureDocument>(
  "treasures",
  treasureSchema
);
