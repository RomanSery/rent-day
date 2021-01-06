import mongoose from "mongoose";
import { Socket } from "socket.io";

export interface GameSocket extends Socket {
  playerName: string;
  userId: mongoose.Types.ObjectId;
  gameId: mongoose.Types.ObjectId;
  latency: number;
}
