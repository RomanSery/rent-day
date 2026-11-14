import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCirclePlay, faFire, faRobot, faTrophy } from "@fortawesome/free-solid-svg-icons";
import API from "../api";
import { BackLink } from "../components/BackLink";
import { areObjectIdsEqual, dollarFormatter, getMyUserId } from "../helpers";
import { HistoryGame, PlayerProfile } from "../../core/types/PlayerProfile";
import { SquareConfigDataMap, squareGroupColorMap } from "../../core/config/SquareData";

/** Where a profile's back link goes, passed as router state by the link that opened it. */
export interface ProfileBack {
  to: string;
  label: string;
}

/** Router state for a link to a profile: `<Link to=... state={profileFrom(...)}>`. */
export const profileFrom = (to: string, label: string): { back: ProfileBack } => ({ back: { to, label } });

const LOBBY: ProfileBack = { to: "/dashboard", label: "Lobby" };
const LEADERBOARD: ProfileBack = { to: "/players", label: "Leaderboard" };

/** the back target from router state, if it is a plain in-app path */
const backFromState = (state: unknown): ProfileBack | null => {
  const back = (state as { back?: Partial<ProfileBack> } | null)?.back;
  if (back && typeof back.to === "string" && typeof back.label === "string" &&
    back.to.startsWith("/") && !back.to.startsWith("//")) {
    return { to: back.to, label: back.label };
  }
  return null;
};

const pct = (wins: number, games: number): string =>
  games > 0 ? Math.round((wins / games) * 100) + "%" : "—";

const ordinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const shortDate = (iso?: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: thisYear ? undefined : "numeric" });
};

const monthYear = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

/** board colour class of a property's group (board.css), if it has one */
const groupClass = (squareId: number): string => {
  const groupId = SquareConfigDataMap.get(squareId)?.groupId;
  return (groupId != null && squareGroupColorMap.get(groupId)) || "pf-nogroup";
};

const Tile: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="pf-tile" title={hint}>
    <span className="pf-tile-value">{value}</span>
    <span className="pf-tile-label">{label}</span>
  </div>
);

const Section: React.FC<{ title: string; className?: string; children: React.ReactNode }> = ({ title, className, children }) => (
  <section className={"pf-section " + (className ?? "")}>
    <h2>{title}</h2>
    {children}
  </section>
);

const GameRow: React.FC<{ game: HistoryGame; playerId: string; back: ProfileBack }> = ({ game, playerId, back }) => {
  const seats = [...game.seats].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  return (
    <li className="pf-game">
      <span className={"pf-result " + (game.won ? "won" : "lost")}>
        {game.won ? <><FontAwesomeIcon icon={faTrophy} /> Won</> : game.rank ? ordinal(game.rank) : "Out"}
      </span>
      <div className="pf-game-main">
        <div className="pf-game-title">
          <span className="pf-game-name">{game.name}</span>
          <span className="pf-game-meta">{game.playerClass} · {game.turns} turns · {shortDate(game.endedAt)}</span>
        </div>
        <ol className="pf-seats" aria-label="Finishing order">
          {seats.map((s) => (
            <li key={s.id} className={areObjectIdsEqual(s.id, playerId) ? "is-self" : undefined}>
              <i style={{ background: s.color }} aria-hidden="true" />
              {s.bot || areObjectIdsEqual(s.id, playerId)
                ? <span>{s.name}{s.bot && <FontAwesomeIcon icon={faRobot} className="pf-bot" title="Computer player" />}</span>
                : <Link to={"/profile/" + s.id} state={{ back }}>{s.name}</Link>}
              <span className="pf-seat-worth">{s.worth === 0 && s.rank !== 1 ? "out" : dollarFormatter.format(s.worth)}</span>
            </li>
          ))}
        </ol>
      </div>
    </li>
  );
};

export const PlayerProfilePage: React.FC = () => {
  const { playerId = "" } = useParams();
  const isMe = areObjectIdsEqual(playerId, getMyUserId());
  // back to wherever the profile was opened from (kept while hopping between
  // profiles); opened directly, your own goes to the lobby, others' to the
  // leaderboard
  const location = useLocation();
  const back = backFromState(location.state) ?? (isMe ? LOBBY : LEADERBOARD);

  const query = useQuery<PlayerProfile, Error>({
    queryKey: ["profile", playerId],
    queryFn: () => API.post("getProfile", { playerId }).then((response) => response.data.profile),
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (query.isError) {
    const notFound = (query.error as any)?.response?.status === 404;
    return (
      <div className="profile">
        <BackLink to={back.to} label={back.label} />
        <p className="lb-note">{notFound ? "There's no player with that link." : "Couldn't load this profile: " + query.error.message}</p>
      </div>
    );
  }
  if (query.isLoading || !query.data) {
    return <div className="profile"><p className="lb-note">Loading the profile&hellip;</p></div>;
  }

  const p = query.data;
  const people = p.opponents.filter((o) => !o.bot);
  const bots = p.opponents.find((o) => o.bot);
  const comeback = p.biggestComeback;

  return (
    <div className="profile">
      <header className="pf-head">
        <BackLink to={back.to} label={back.label} />
        <h1>
          {p.name}
          {isMe && <span className="lb-you">you</span>}
          {p.currentStreak >= 2 &&
            <span className="lb-streak" title={`${p.currentStreak} wins in a row`}><FontAwesomeIcon icon={faFire} /> {p.currentStreak}</span>}
        </h1>
        <p className="lb-sub">
          {p.memberSince && <>Playing since {monthYear(p.memberSince)}</>}
          {p.currGame && <span className="lb-live"><FontAwesomeIcon icon={faCirclePlay} /> Playing {p.currGame}</span>}
        </p>
      </header>

      <div className="pf-tiles">
        <Tile label="Wins" value={p.wins} />
        <Tile label="Win rate" value={pct(p.wins, p.gamesPlayed)} hint={`${p.wins} wins in ${p.gamesPlayed} games`} />
        <Tile label="Games" value={p.gamesPlayed} />
        <Tile label="Best streak" value={p.bestStreak || "—"} hint="Most wins in a row" />
        <Tile label="Best win" value={p.bestWinWorth ? dollarFormatter.format(p.bestWinWorth) : "—"} hint="Net worth at the end of their best win" />
        <Tile label="Rent collected" value={p.rentCollected ? dollarFormatter.format(p.rentCollected) : "—"} />
      </div>

      {p.historyGames === 0
        ? <p className="pf-empty">
          {isMe ? "You haven't" : p.name + " hasn't"} finished a game since game history began.
          Class records, favourite properties and head-to-head results appear here after the next one.
        </p>
        : <div className="pf-grid">
          <Section title="By class">
            <ul className="pf-classes">
              {p.classes.map((c) => (
                <li key={c.playerClass}>
                  <span className="pf-class-name">{c.playerClass}</span>
                  <span className="lb-bar" aria-hidden="true"><i style={{ width: (c.wins / c.games) * 100 + "%" }} /></span>
                  <span className="pf-class-num">{pct(c.wins, c.games)}</span>
                  <span className="pf-class-games">{c.wins} of {c.games}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Biggest comeback">
            {comeback
              ? <p className="pf-comeback">
                <b>{dollarFormatter.format(comeback.deficit)}</b> behind the leader
                {comeback.turn ? <> on turn {comeback.turn}</> : null}, and won <i>{comeback.gameName}</i>
                <span className="pf-when"> · {shortDate(comeback.endedAt)}</span>
              </p>
              : <p className="lb-note">No wins from behind yet.</p>}
          </Section>

          <Section title="Head to head">
            {people.length === 0 && !bots
              ? <p className="lb-note">No opponents yet.</p>
              : <table className="pf-h2h">
                <thead>
                  <tr><th scope="col">Against</th><th scope="col" className="num">Games</th><th scope="col" className="num" title="Finished ahead – finished behind">Record</th></tr>
                </thead>
                <tbody>
                  {people.map((o) => (
                    <tr key={o.playerId}>
                      <td><Link to={"/profile/" + o.playerId} state={{ back }}>{o.name}</Link></td>
                      <td className="num">{o.games}</td>
                      <td className={"num " + (o.ahead > o.behind ? "up" : o.ahead < o.behind ? "down" : "")}>{o.ahead}–{o.behind}</td>
                    </tr>
                  ))}
                  {bots &&
                    <tr className="pf-bots-row">
                      <td><FontAwesomeIcon icon={faRobot} /> {bots.name}</td>
                      <td className="num">{bots.games}</td>
                      <td className={"num " + (bots.ahead > bots.behind ? "up" : bots.ahead < bots.behind ? "down" : "")}
                        title="Ahead means finishing above every computer player">{bots.ahead}–{bots.behind}</td>
                    </tr>}
                </tbody>
              </table>}
          </Section>

          <Section title="Favourite properties">
            {p.favouriteProperties.length === 0
              ? <p className="lb-note">No properties owned yet.</p>
              : <ol className="pf-props">
                {p.favouriteProperties.map((f) => (
                  <li key={f.squareId}>
                    <i className={groupClass(f.squareId)} aria-hidden="true" />
                    <span className="pf-prop-name">{f.name}</span>
                    <span className="pf-prop-num">{f.games} {f.games === 1 ? "game" : "games"} · {f.turnsHeld} {f.turnsHeld === 1 ? "turn" : "turns"}</span>
                  </li>
                ))}
              </ol>}
          </Section>

          <Section title="Recent games" className="pf-wide">
            <ol className="pf-games">
              {p.recentGames.map((g) => <GameRow key={g.gameId} game={g} playerId={p.playerId} back={back} />)}
            </ol>
          </Section>
        </div>}

      <footer className="lb-foot">
        <span>
          Class records, properties, head-to-head and comebacks count games finished since game history began
          {p.historyGames > 0 && <> ({p.historyGames} so far)</>}.
        </span>
      </footer>
    </div>
  );
};
