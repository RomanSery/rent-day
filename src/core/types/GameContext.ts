import mongoose from "mongoose";
export interface GameContext {
  readonly gameId: mongoose.Types.ObjectId | null;
  readonly userId: mongoose.Types.ObjectId | null;
  readonly authToken: string;
}
