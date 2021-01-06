import mongoose from "mongoose";
export interface GameToJoin {
  readonly gameId: mongoose.Types.ObjectId;
  readonly name: string;
  readonly maxPlayers: number;
  readonly playersJoined: number;
}
