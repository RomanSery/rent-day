import mongoose from "mongoose";
export interface GameContext {
  readonly gameId: mongoose.Types.ObjectId;
  readonly userId: mongoose.Types.ObjectId;
  readonly authToken: string;
}
