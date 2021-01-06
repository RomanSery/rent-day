import mongoose from "mongoose";
export interface JoinedGameMsg {
  playerName: string;
  userId: mongoose.Types.ObjectId;
  gameId: mongoose.Types.ObjectId;
  allJoined: boolean;
}

export interface LatencyInfoMsg {
  userId: mongoose.Types.ObjectId;
  latency: number;
}
