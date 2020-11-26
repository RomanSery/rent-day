import { Socket } from "socket.io";

export interface GameSocket extends Socket {
  playerName: string;
  playerId: string;
  latency: number;
}
