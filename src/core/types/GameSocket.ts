import { Socket } from "socket.io";

export interface GameSocket extends Socket {
  playerName: string;
  playerId: string;
  gameId: string;
  latency: number;
}
