import mongoose from "mongoose";

export type UserDocument = mongoose.Document & {
  username: string;
  password: string;
  wins: number;
  gamesPlayed: number;
  currGameId?: string;
  currGameName?: string;
};

const userSchema = new mongoose.Schema(
  {
    username: String,
    password: String,
    wins: Number,
    gamesPlayed: Number,
    currGameId: String,
    currGameName: String,
  },
  { timestamps: true }
);

export const UserInstance = mongoose.model<UserDocument>("users", userSchema);
