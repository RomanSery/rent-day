import {
  ClassRecord,
  Comeback,
  FavouriteProperty,
  HistoryGame,
  HistorySeat,
  OpponentRecord,
} from "@core/types/PlayerProfile";
import { GameHistoryRecord } from "../game/history";

/** finished games a profile reads (newest first) */
export const PROFILE_GAMES_READ = 300;
const RECENT_GAMES = 20;
const FAVOURITES = 5;
const OPPONENTS = 12;
/** id of the one row that sums up every game against computer players */
export const BOTS_OPPONENT_ID = "bots";

interface ProfileRow {
  game_id: string;
  ended_at: string;
  player_class: string;
  finished_rank: number | null;
  won: number;
  final_worth: number;
  max_deficit: number;
  deficit_turn: number | null;
  properties: string;
  name: string;
  minutes: number | null;
  turns: number;
  players: string;
}

export interface HistoryStats {
  historyGames: number;
  classes: ClassRecord[];
  favouriteProperties: FavouriteProperty[];
  opponents: OpponentRecord[];
  biggestComeback?: Comeback;
  recentGames: HistoryGame[];
}

const parse = <T>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    return fallback;
  }
};

/** Finished games, kept after each game's own storage is purged. */
export class HistoryRepo {
  constructor(private readonly db: D1Database) {}

  /** Store a finished game; a second call for the same game changes nothing. */
  async record(rec: GameHistoryRecord): Promise<void> {
    const statements = [
      this.db
        .prepare(
          `INSERT OR IGNORE INTO game_history (id, name, started_at, ended_at, minutes, turns, winner_name, players)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          rec.gameId,
          rec.name,
          rec.startedAt,
          rec.endedAt,
          rec.minutes,
          rec.turns,
          rec.winnerName,
          JSON.stringify(rec.seats)
        ),
      ...rec.players.map((p) =>
        this.db
          .prepare(
            `INSERT OR IGNORE INTO game_history_players
               (user_id, game_id, ended_at, player_class, finished_rank, won, final_worth, max_deficit, deficit_turn, properties)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            p.userId,
            rec.gameId,
            rec.endedAt,
            p.playerClass,
            p.rank,
            p.won ? 1 : 0,
            p.finalWorth,
            p.maxDeficit,
            p.deficitTurn,
            JSON.stringify(p.properties)
          )
      ),
    ];
    await this.db.batch(statements);
  }

  /** Everything a profile shows that comes from finished games. */
  async statsFor(userId: string): Promise<HistoryStats> {
    const result = await this.db
      .prepare(
        `SELECT hp.game_id, hp.ended_at, hp.player_class, hp.finished_rank, hp.won, hp.final_worth,
                hp.max_deficit, hp.deficit_turn, hp.properties,
                h.name, h.minutes, h.turns, h.players
           FROM game_history_players hp JOIN game_history h ON h.id = hp.game_id
          WHERE hp.user_id = ?
          ORDER BY hp.ended_at DESC
          LIMIT ?`
      )
      .bind(userId, PROFILE_GAMES_READ)
      .all<ProfileRow>();
    return HistoryRepo.aggregate(userId, result.results ?? []);
  }

  private static aggregate(userId: string, rows: ProfileRow[]): HistoryStats {
    const classes = new Map<string, { games: number; wins: number }>();
    const props = new Map<number, { name: string; games: number; turnsHeld: number }>();
    const opponents = new Map<string, { name: string; bot: boolean; games: number; ahead: number; behind: number }>();
    let biggestComeback: Comeback | undefined;
    const recentGames: HistoryGame[] = [];

    for (const row of rows) {
      const won = row.won === 1;
      const seats = parse<HistorySeat[]>(row.players, []);

      const cls = classes.get(row.player_class) ?? { games: 0, wins: 0 };
      cls.games++;
      if (won) cls.wins++;
      classes.set(row.player_class, cls);

      for (const [squareId, name, turns] of parse<Array<[number, string, number]>>(row.properties, [])) {
        const p = props.get(squareId) ?? { name, games: 0, turnsHeld: 0 };
        p.games++;
        p.turnsHeld += turns;
        props.set(squareId, p);
      }

      // finishing ahead means a better (lower) rank; a missing rank is last
      const myRank = row.finished_rank ?? Number.MAX_SAFE_INTEGER;
      const botsMet = seats.filter((s) => s.bot);
      for (const s of seats) {
        if (s.id === userId || s.bot) continue;
        // rows are newest first, so the name kept is their latest
        const o = opponents.get(s.id) ?? { name: s.name, bot: false, games: 0, ahead: 0, behind: 0 };
        o.games++;
        const theirs = s.rank ?? Number.MAX_SAFE_INTEGER;
        if (myRank < theirs) o.ahead++;
        else if (myRank > theirs) o.behind++;
        opponents.set(s.id, o);
      }
      if (botsMet.length > 0) {
        // one game against computer players: ahead if they beat every bot
        const o = opponents.get(BOTS_OPPONENT_ID) ?? { name: "Computer players", bot: true, games: 0, ahead: 0, behind: 0 };
        o.games++;
        if (botsMet.every((b) => myRank < (b.rank ?? Number.MAX_SAFE_INTEGER))) o.ahead++;
        else o.behind++;
        opponents.set(BOTS_OPPONENT_ID, o);
      }

      if (won && row.max_deficit > 0 && (!biggestComeback || row.max_deficit > biggestComeback.deficit)) {
        biggestComeback = {
          gameId: row.game_id,
          gameName: row.name,
          endedAt: row.ended_at,
          deficit: row.max_deficit,
          turn: row.deficit_turn ?? undefined,
        };
      }

      if (recentGames.length < RECENT_GAMES) {
        recentGames.push({
          gameId: row.game_id,
          name: row.name,
          endedAt: row.ended_at,
          minutes: row.minutes ?? undefined,
          turns: row.turns,
          playerClass: row.player_class,
          rank: row.finished_rank ?? undefined,
          won,
          finalWorth: row.final_worth,
          seats,
        });
      }
    }

    return {
      historyGames: rows.length,
      classes: Array.from(classes, ([playerClass, c]) => ({ playerClass, ...c }))
        .sort((a, b) => b.games - a.games || a.playerClass.localeCompare(b.playerClass)),
      favouriteProperties: Array.from(props, ([squareId, p]) => ({ squareId, ...p }))
        .sort((a, b) => b.games - a.games || b.turnsHeld - a.turnsHeld || a.squareId - b.squareId)
        .slice(0, FAVOURITES),
      // the people they play most, then one line for all computer players
      opponents: Array.from(opponents, ([playerId, o]) => ({ playerId, ...o }))
        .sort((a, b) => Number(a.bot) - Number(b.bot) || b.games - a.games || a.name.localeCompare(b.name))
        .filter((o, i) => o.bot || i < OPPONENTS),
      biggestComeback,
      recentGames,
    };
  }
}
