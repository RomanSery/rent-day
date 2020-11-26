export interface JoinedGameMsg {
  playerName: string;
  playerId: string;
  allJoined: boolean;
}

export interface LatencyInfoMsg {
  playerId: string;
  latency: number;
}
