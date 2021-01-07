import mongoose from "mongoose";
export interface JoinedGameMsg {
  playerName: string;
  userId: string;
  gameId: string;
  allJoined: boolean;
}

export interface LatencyInfoMsg {
  userId: mongoose.Types.ObjectId;
  latency: number;
}
