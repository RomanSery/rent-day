import { Socket } from "socket.io";

export interface GameSocket extends Socket {
  playerName: string;
  userId: string;
  gameId: string;
  latency: number;
}
