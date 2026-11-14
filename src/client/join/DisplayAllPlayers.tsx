import React, { useMemo, useState } from "react";
import API from '../api';
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFire, faTrophy, faCirclePlay } from "@fortawesome/free-solid-svg-icons";
import { BackLink } from "../components/BackLink";
import { areObjectIdsEqual, dollarFormatter, getGameContextFromLocalStorage, getMyUserId } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import { PlayerInfo } from "../../core/types/PlayerInfo";
import { profileFrom } from "./PlayerProfilePage";

type SortKey = "wins" | "winRate" | "games";

/** rows shown before "Show all" (your own row is always shown) */
const TOP_ROWS = 25;

/** win rate only ranks players with at least this many games */
const MIN_GAMES_FOR_RATE = 3;

const winRate = (p: PlayerInfo): number | null =>
  p.gamesPlayed > 0 ? p.wins / p.gamesPlayed : null;

const pct = (r: number | null): string => (r == null ? "—" : Math.round(r * 100) + "%");

const relFmt = typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl
  ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  : null;

/** "today", "yesterday", "3 days ago", or a date for anything older than a month */
const lastPlayed = (iso?: string): string => {
  if (!iso) return "—";
  const then = new Date(iso);
  if (isNaN(then.getTime())) return "—";
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days < 31 && relFmt) return relFmt.format(-days, "day");
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short", year: days > 330 ? "numeric" : undefined });
};

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "wins", label: "Most wins" },
  { key: "winRate", label: "Win rate" },
  { key: "games", label: "Most games" },
];

export const DisplayAllPlayers: React.FC = () => {

  const context: GameContext = getGameContextFromLocalStorage();
  const me = getMyUserId();
  const [sort, setSort] = useState<SortKey>("wins");
  const [showAll, setShowAll] = useState(false);

  const playersQuery = useQuery<PlayerInfo[], Error>({
    queryKey: ["getAllPlayers"],
    queryFn: () => API.post("findPlayers", { context }).then(function (response) { return response.data.players; }),
    refetchOnWindowFocus: false,
  });

  // sorted, with shared ranks for ties
  const rows = useMemo(() => {
    const players = playersQuery.data ?? [];
    const value = (p: PlayerInfo): number => {
      if (sort === "wins") return p.wins;
      if (sort === "games") return p.gamesPlayed;
      return p.gamesPlayed >= MIN_GAMES_FOR_RATE ? winRate(p) ?? -1 : -1;
    };
    const sorted = [...players].sort((a, b) =>
      value(b) - value(a) || b.wins - a.wins || b.gamesPlayed - a.gamesPlayed || a.name.localeCompare(b.name));
    let rank = 0;
    return sorted.map((p, i) => {
      if (i === 0 || value(p) !== value(sorted[i - 1])) rank = i + 1;
      return { p, rank, ranked: value(p) > 0 };
    });
  }, [playersQuery.data, sort]);

  if (playersQuery.isError) {
    return <div className="leaderboard"><p className="lb-note">Couldn't load the leaderboard: {playersQuery.error!.message}</p></div>;
  }
  if (playersQuery.isLoading || !playersQuery.data) {
    return <div className="leaderboard"><p className="lb-note">Loading the leaderboard&hellip;</p></div>;
  }

  const totalWins = rows.reduce((n, r) => n + r.p.wins, 0);
  const visible = showAll ? rows : rows.filter((r, i) => i < TOP_ROWS || areObjectIdsEqual(r.p.playerId, me));
  const hidden = rows.length - visible.length;
  const podium = sort === "wins" ? rows.filter((r) => r.p.wins > 0).slice(0, 3) : [];
  const medal = (rank: number) => (rank <= 3 ? ["gold", "silver", "bronze"][rank - 1] : "");

  return (
    <div className="leaderboard">
      <header className="lb-head">
        <div>
          <BackLink to="/dashboard" label="Lobby" />
          <h1>Leaderboard</h1>
          <p className="lb-sub">
            {rows.length} {rows.length === 1 ? "player" : "players"} · {totalWins} {totalWins === 1 ? "game" : "games"} won
          </p>
        </div>
        <div className="lb-sorts" role="group" aria-label="Rank by">
          {SORTS.map((s) => (
            <button key={s.key} type="button" aria-pressed={sort === s.key} onClick={() => setSort(s.key)}>{s.label}</button>
          ))}
        </div>
      </header>

      {podium.length > 0 &&
        <ol className="lb-podium" aria-label="Top players">
          {podium.map(({ p, rank }) => (
            <li key={p.playerId} className={"lb-podium-item " + medal(rank)}>
              <span className="lb-medal" aria-label={"Rank " + rank}><FontAwesomeIcon icon={faTrophy} /> {rank}</span>
              <span className="lb-podium-name"><Link to={"/profile/" + p.playerId} state={profileFrom("/players", "Leaderboard")}>{p.name}</Link>{areObjectIdsEqual(p.playerId, me) && <span className="lb-you">you</span>}</span>
              <span className="lb-podium-wins"><b>{p.wins}</b> {p.wins === 1 ? "win" : "wins"}</span>
              <span className="lb-podium-rate">{pct(winRate(p))} win rate · {p.gamesPlayed} games</span>
            </li>
          ))}
        </ol>}

      {sort === "winRate" &&
        <p className="lb-note">Win rate ranks players with at least {MIN_GAMES_FOR_RATE} games.</p>}

      {rows.length === 0
        ? <p className="lb-note">Nobody has played yet. Finish a game to get on the board.</p>
        : <table className="lb-table">
          <thead>
            <tr>
              <th scope="col" className="lb-rank">#</th>
              <th scope="col">Player</th>
              <th scope="col" className="num">Wins</th>
              <th scope="col" className="num lb-wide">W–L</th>
              <th scope="col" className="lb-rate">Win rate</th>
              <th scope="col" className="num lb-wide" title="Most wins in a row">Best streak</th>
              <th scope="col" className="num lb-wide" title="Net worth at the end of their best win">Best win</th>
              <th scope="col" className="num lb-wide" title="Rent collected across finished games">Rent collected</th>
              <th scope="col" className="lb-wide">Last played</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ p, rank, ranked }) => {
              const isMe = areObjectIdsEqual(p.playerId, me);
              const rate = winRate(p);
              return (
                <tr key={p.playerId} className={isMe ? "is-me" : undefined}>
                  <td className={"lb-rank " + (ranked ? medal(rank) : "")}>{ranked ? rank : "–"}</td>
                  <td className="lb-player">
                    <span className="lb-name">
                      <Link to={"/profile/" + p.playerId} state={profileFrom("/players", "Leaderboard")}>{p.name}</Link>
                      {isMe && <span className="lb-you">you</span>}
                      {p.currentStreak >= 2 &&
                        <span className="lb-streak" title={`${p.currentStreak} wins in a row`}><FontAwesomeIcon icon={faFire} /> {p.currentStreak}</span>}
                    </span>
                    {p.currGame &&
                      <span className="lb-live"><FontAwesomeIcon icon={faCirclePlay} /> Playing {p.currGame}</span>}
                    <span className="lb-brief">
                      {p.gamesPlayed} {p.gamesPlayed === 1 ? "game" : "games"} · {pct(rate)}
                      {p.lastPlayedAt && <> · last played {lastPlayed(p.lastPlayedAt).toLowerCase()}</>}
                    </span>
                  </td>
                  <td className="num lb-wins">{p.wins}</td>
                  <td className="num lb-wide">{p.wins}–{p.losses}</td>
                  <td className="lb-rate">
                    <span className="lb-bar" aria-hidden="true"><i style={{ width: (rate ?? 0) * 100 + "%" }} /></span>
                    <span className="lb-rate-num">{pct(rate)}</span>
                  </td>
                  <td className="num lb-wide">{p.bestStreak || "—"}</td>
                  <td className="num lb-wide">{p.bestWinWorth ? dollarFormatter.format(p.bestWinWorth) : "—"}</td>
                  <td className="num lb-wide">{p.rentCollected ? dollarFormatter.format(p.rentCollected) : "—"}</td>
                  <td className="lb-wide lb-when">{lastPlayed(p.lastPlayedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>}

      {hidden > 0 &&
        <button type="button" className="lb-more" onClick={() => setShowAll(true)}>Show all {rows.length} players</button>}

      <footer className="lb-foot">
        <span>Streaks, best wins, rent and last played count games finished from now on.</span>
      </footer>
    </div>
  );
}
