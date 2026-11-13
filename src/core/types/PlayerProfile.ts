/** One seat in a finished game, as the history keeps it. */
export interface HistorySeat {
  readonly id: string;
  readonly name: string;
  readonly bot: boolean;
  readonly cls: string;
  /** 1 = won; missing on a seat that never finished (should not happen) */
  readonly rank?: number;
  /** net worth at the end; 0 for a player who went bankrupt or resigned */
  readonly worth: number;
  readonly color: string;
}

/** A finished game in a player's history. */
export interface HistoryGame {
  readonly gameId: string;
  readonly name: string;
  readonly endedAt: string;
  readonly minutes?: number;
  readonly turns: number;
  readonly playerClass: string;
  readonly rank?: number;
  readonly won: boolean;
  readonly finalWorth: number;
  readonly seats: HistorySeat[];
}

export interface ClassRecord {
  readonly playerClass: string;
  readonly games: number;
  readonly wins: number;
}

export interface FavouriteProperty {
  readonly squareId: number;
  readonly name: string;
  /** games in which they held it */
  readonly games: number;
  readonly turnsHeld: number;
}

/** Head-to-head against another account (or, with bot set, all computer players). */
export interface OpponentRecord {
  readonly playerId: string;
  readonly name: string;
  readonly bot: boolean;
  readonly games: number;
  /** games where this player finished ahead of them, and behind */
  readonly ahead: number;
  readonly behind: number;
}

export interface Comeback {
  readonly gameId: string;
  readonly gameName: string;
  readonly endedAt: string;
  /** how far behind the leader they were, and on which turn */
  readonly deficit: number;
  readonly turn?: number;
}

export interface PlayerProfile {
  readonly playerId: string;
  readonly name: string;
  readonly memberSince: string;
  readonly wins: number;
  readonly losses: number;
  readonly gamesPlayed: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly bestWinWorth: number;
  readonly rentCollected: number;
  readonly auctionsWon: number;
  readonly currGame?: string;

  /** games in the history (finished since history began, up to the read limit) */
  readonly historyGames: number;
  readonly classes: ClassRecord[];
  readonly favouriteProperties: FavouriteProperty[];
  readonly opponents: OpponentRecord[];
  readonly biggestComeback?: Comeback;
  /** newest first */
  readonly recentGames: HistoryGame[];
}
