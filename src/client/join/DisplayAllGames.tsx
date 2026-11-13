import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock, faRobot, faRotateRight, faUser, faPlus } from "@fortawesome/free-solid-svg-icons";
import { BackLink } from "../components/BackLink";
import API from '../api';
import { GameToJoin } from "../../core/types/GameToJoin";
import { getGameContextFromLocalStorage, getObjectIdAsHexString, leaveCurrentGameIfJoined } from "../helpers";
import { GameContext } from "../../core/types/GameContext";

/** how often the list refreshes itself while the page is open */
const REFRESH_MS = 10000;

/** "just now", "5 min ago", "2 h ago" */
const age = (iso: string): string => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  return Math.floor(mins / 60) + " h ago";
};

/** One marker per seat: people who joined, computer players, open seats. */
const Seats: React.FC<{ game: GameToJoin }> = ({ game }) => {
  const humans = Math.max(0, game.playersJoined - game.bots);
  const open = Math.max(0, game.maxPlayers - game.playersJoined);
  const seats = [
    ...Array.from({ length: humans }, () => "human"),
    ...Array.from({ length: game.bots }, () => "bot"),
    ...Array.from({ length: open }, () => "open"),
  ];
  return (
    <span className="gl-seats" aria-hidden="true">
      {seats.map((kind, i) => (
        <span key={i} className={"gl-seat " + kind}>
          {kind === "human" && <FontAwesomeIcon icon={faUser} />}
          {kind === "bot" && <FontAwesomeIcon icon={faRobot} />}
        </span>
      ))}
    </span>
  );
};

export const DisplayAllGames: React.FC = () => {

  const context: GameContext = getGameContextFromLocalStorage();
  const navigate = useNavigate();

  const onJoinGame = (gameId: string) => {
    leaveCurrentGameIfJoined(null, () => {
      navigate("/join?gid=" + gameId);
    });
  };

  const gamesQuery = useQuery<GameToJoin[], Error>({
    queryKey: ["getAllGames"],
    queryFn: () => API.post("findGames", { context }).then(function (response) { return response.data.games; }),
    refetchInterval: REFRESH_MS,
  });

  const games = gamesQuery.data ?? [];

  const body = () => {
    if (gamesQuery.isError) {
      return <p className="gl-note">Couldn't load the games: {gamesQuery.error!.message}</p>;
    }
    if (gamesQuery.isLoading) {
      return <p className="gl-note">Looking for open games&hellip;</p>;
    }
    if (games.length === 0) {
      return (
        <div className="gl-empty">
          <p><b>No open games right now.</b></p>
          <p>Start one and others can join from here, or fill the seats with computer players.</p>
          <Button component={Link} to="/create" variant="contained" startIcon={<FontAwesomeIcon icon={faPlus} />}>Create a game</Button>
        </div>
      );
    }
    return (
      <ul className="gl-list">
        {games.map((g) => {
          const open = Math.max(0, g.maxPlayers - g.playersJoined);
          return (
            <li key={getObjectIdAsHexString(g.gameId)} className="gl-card">
              <div className="gl-main">
                <div className="gl-title">
                  <span className="gl-name">{g.name}</span>
                  {g.hasPassword && <span className="gl-lock" title="Needs a password to join"><FontAwesomeIcon icon={faLock} /> Password</span>}
                </div>
                <div className="gl-meta">
                  {g.hostName ? <>Hosted by <b>{g.hostName}</b> · </> : null}
                  created {age(g.createdAt)}
                </div>
                <div className="gl-seat-row">
                  <Seats game={g} />
                  <span className="gl-seat-text">
                    {open} {open === 1 ? "seat" : "seats"} open of {g.maxPlayers}
                    {g.bots > 0 && <> · {g.bots} computer</>}
                  </span>
                </div>
              </div>
              <Button variant="contained" color="secondary" className="gl-join" onClick={() => onJoinGame(g.gameId)}>
                Join
              </Button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="game-list">
      <header className="gl-head">
        <div>
          <BackLink to="/dashboard" label="Lobby" />
          <h1>Join a game</h1>
          <p className="gl-sub">
            {gamesQuery.isSuccess ? `${games.length} open ${games.length === 1 ? "game" : "games"} · updates every ${REFRESH_MS / 1000} seconds` : " "}
          </p>
        </div>
        <div className="gl-actions">
          <Button variant="outlined" size="small" onClick={() => gamesQuery.refetch()} disabled={gamesQuery.isFetching}
            startIcon={<FontAwesomeIcon icon={faRotateRight} spin={gamesQuery.isFetching} />}>
            Refresh
          </Button>
          <Button component={Link} to="/create" variant="text" size="small" startIcon={<FontAwesomeIcon icon={faPlus} />}>
            New game
          </Button>
        </div>
      </header>
      {body()}
    </div>
  );
}
