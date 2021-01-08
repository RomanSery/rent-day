export interface JoinedGameMsg {
  playerName: string;
  userId: string;
  gameId: string;
  allJoined: boolean;
}

export interface LatencyInfoMsg {
  userId: string;
  latency: number;
}
