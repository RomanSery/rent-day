// Plain data types for everything the backend persists.
// These replace the old mongoose schemas; ids are plain strings.

import { GameStatus } from "@core/enums/GameStatus";
import { Bidder } from "@core/types/Bidder";
import { ChatMsg } from "@core/types/ChatMsg";
import { LastResult } from "@core/types/LastResult";
import { Player } from "@core/types/Player";
import { Settings } from "@core/types/Settings";
import { SquareGameData } from "@core/types/SquareGameData";
import { SquareThemeData } from "@core/types/SquareThemeData";
import { TradeParticipant } from "@core/types/TradeParticipant";

export interface GameInstanceDocument {
  _id: string;
  name: string;
  players: Player[];
  settings: Settings;
  theme: Record<string, SquareThemeData>;
  squareState: SquareGameData[];
  nextPlayerToAct: string | null;
  nextPlayerActBy: string | null;
  auctionId: string | null;
  auctionSquareId: number | null;
  lottoId: string | null;
  allJoined: boolean;
  status: GameStatus;
  results: LastResult | null;
  createdBy: string;
  messages: ChatMsg[];
  log: ChatMsg[];
  gameLength: number | null;
  winner: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuctionDocument {
  _id: string;
  gameId: string;
  winnerId: string | null;
  bidders: Bidder[];
  finished: boolean;
  squareId: number;
  isTie: boolean;
  endsAt: string;
  createdAt: string;
}

export interface LottoDocument {
  _id: string;
  gameId: string;
  playerId: string;
  playerName: string;
  playerColor: string;

  option1Amount: number;
  option1Percent: number;

  option2Amount: number;
  option2Percent: number;

  option3Amount: number;
  option3Percent: number;

  optionPicked: number | null;
  randomNum: number | null;

  prize: number | null;
  createdAt: string;
}

export interface TradeDocument {
  _id: string;
  gameId: string;
  participant1: TradeParticipant;
  participant2: TradeParticipant;
  status: string;
  createdAt: string;
}

export interface UserDocument {
  _id: string;
  email: string;
  username: string;
  modifiedUsername: string;
  password: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  currGameId?: string;
  currGameName?: string;
  createdAt: string;
  updatedAt: string;
}
