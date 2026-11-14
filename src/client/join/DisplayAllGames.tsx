import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Tab, Tabs } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faLock, faRobot, faRotateRight, faUser, faPlus } from "@fortawesome/free-solid-svg-icons";
import { BackLink } from "../components/BackLink";
import API from '../api';
import { GameToJoin } from "../../core/types/GameToJoin";
import { GameToWatch } from "../../core/types/GameToWatch";
import { getGameContextFromLocalStorage, getObjectIdAsHexString, leaveCurrentGameIfJoined } from "../helpers";
import { GameContext } from "../../core/types/GameContext";

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

interface FoundGames {
  games: GameToJoin[];
  live: GameToWatch[];
}

/** Games being played right now, with a button to watch. */
const LiveGames: React.FC<{ live: GameToWatch[] }> = ({ live }) => {
  const navigate = useNavigate();
  if (live.length === 0) {
    return <p className="gl-note">No public games are being played right now.</p>;
  }
  return (
    <ul className="gl-list">
      {live.map((g) => {
        const humans = Math.max(0, g.playersJoined - g.bots);
        return (
          <li key={getObjectIdAsHexString(g.gameId)} className="gl-card">
            <div className="gl-main">
              <div className="gl-title">
                <span className="gl-name">{g.name}</span>
                <span className="gl-live">Live</span>
              </div>
              <div className="gl-meta">
                {g.hostName ? <>Hosted by <b>{g.hostName}</b> · </> : null}
                last move {age(g.lastMoveAt)}
              </div>
              <div className="gl-seat-row">
                <span className="gl-seat-text">
                  {humans} {humans === 1 ? "player" : "players"}
                  {g.bots > 0 && <> · {g.bots} computer</>}
                </span>
              </div>
            </div>
            <Button variant="outlined" color="secondary" className="gl-join" startIcon={<FontAwesomeIcon icon={faEye} />}
              onClick={() => navigate("/watch/" + getObjectIdAsHexString(g.gameId))}>
              Watch
            </Button>
          </li>
        );
      })}
    </ul>
  );
};

type ListTab = "join" | "watch";

export const DisplayAllGames: React.FC = () => {

  const context: GameContext = getGameContextFromLocalStorage();
  const navigate = useNavigate();

  // the open tab lives in the URL (?tab=watch), so Back and links keep it
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: ListTab = searchParams.get("tab") === "watch" ? "watch" : "join";
  const onChangeTab = (_: React.SyntheticEvent, next: ListTab) => {
    setSearchParams(next === "watch" ? { tab: "watch" } : {}, { replace: true });
  };

  const onJoinGame = (gameId: string) => {
    leaveCurrentGameIfJoined(null, () => {
      navigate("/join?gid=" + gameId);
    });
  };

  const gamesQuery = useQuery<FoundGames, Error>({
    queryKey: ["getAllGames"],
    queryFn: () => API.post("findGames", { context }).then(function (response) {
      return { games: response.data.games ?? [], live: response.data.live ?? [] };
    }),
    // loaded when the page opens; the Refresh button reloads it. No polling,
    // and no reload on tab focus: each one is a Worker request and a D1 read.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const games = gamesQuery.data?.games ?? [];
  const live = gamesQuery.data?.live ?? [];

  const body = () => {
    if (gamesQuery.isError) {
      return <p className="gl-note">Couldn't load the games: {gamesQuery.error!.message}</p>;
    }
    if (gamesQuery.isLoading) {
      return <p className="gl-note">{tab === "watch" ? "Looking for games in progress" : "Looking for open games"}&hellip;</p>;
    }
    if (tab === "watch") {
      return <LiveGames live={live} />;
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
          <h1>{tab === "watch" ? "Watch a game" : "Join a game"}</h1>
          <p className="gl-sub">
            {!gamesQuery.isSuccess ? " "
              : tab === "watch" ? `${live.length} ${live.length === 1 ? "game" : "games"} in progress`
                : `${games.length} open ${games.length === 1 ? "game" : "games"}`}
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

      <Tabs value={tab} onChange={onChangeTab} className="gl-tabs" aria-label="Open games or games in progress">
        <Tab value="join" label={"Join" + (gamesQuery.isSuccess ? ` (${games.length})` : "")} id="gl-tab-join" aria-controls="gl-panel" />
        <Tab value="watch" label={"Watch live" + (gamesQuery.isSuccess ? ` (${live.length})` : "")} id="gl-tab-watch" aria-controls="gl-panel" />
      </Tabs>

      <div id="gl-panel" role="tabpanel" aria-labelledby={tab === "watch" ? "gl-tab-watch" : "gl-tab-join"}>
        {body()}
      </div>
    </div>
  );
}
