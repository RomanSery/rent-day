export interface JoinedGameMsg {
  playerName: string;
  playerId: string;
  gameId: string;
  allJoined: boolean;
}

export interface LatencyInfoMsg {
  playerId: string;
  latency: number;
}
