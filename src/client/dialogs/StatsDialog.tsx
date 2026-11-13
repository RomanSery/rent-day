import React, { useEffect, useMemo, useState } from "react";
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import useMediaQuery from '@mui/material/useMediaQuery';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBiohazard, faHandshake, faRobot, faTrain, faBolt, faCheck, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { areObjectIdsEqual, dollarFormatter, getIconProp, getMyUserId } from "../helpers";
import { Player } from "../../core/types/Player";
import { PlayerState } from "../../core/enums/PlayerState";
import { SquareType } from "../../core/enums/SquareType";
import { SquareConfigDataMap, squareGroupColorMap } from "../../core/config/SquareData";
import { GameState } from "../../core/types/GameState";
import { getElectricityTooltip, getTaxTooltip } from "../uiHelpers";
import useGameStateStore from "../stores/gameStateStore";
import API from "../api";

interface Props {
  tradeWithPlayer: (player: Player) => void;
}

/** the board's colour groups, in board order, with their squares */
const PROPERTY_GROUPS: Array<{ groupId: number; squares: number[] }> = (() => {
  const groups = new Map<number, number[]>();
  SquareConfigDataMap.forEach((cfg, id) => {
    if (cfg.type === SquareType.Property && cfg.groupId) {
      groups.set(cfg.groupId, [...(groups.get(cfg.groupId) ?? []), id]);
    }
  });
  return Array.from(groups.entries())
    .map(([groupId, squares]) => ({ groupId, squares: squares.sort((a, b) => a - b) }))
    .sort((a, b) => a.squares[0] - b.squares[0]);
})();

const squaresOfType = (type: SquareType): number[] =>
  Array.from(SquareConfigDataMap.entries()).filter(([, c]) => c.type === type).map(([id]) => id);
const STATIONS = squaresOfType(SquareType.TrainStation);
const UTILITIES = squaresOfType(SquareType.Utility);

/** how many turns of history the trend line shows, and the change is measured over */
const TREND_TURNS = 40;
const CHANGE_TURNS = 10;

interface Holdings {
  properties: number;
  fullSets: number;
  houses: number;
  stations: number;
  utilities: number;
  mortgaged: number;
  /** per colour group: how many of its squares this player owns */
  groups: Array<{ groupId: number; owned: number; size: number }>;
}

const holdingsOf = (game: GameState, playerId: string): Holdings => {
  const mine = game.squareState.filter((s) => s.owner && areObjectIdsEqual(s.owner, playerId));
  const ownsSquare = (id: number) => mine.some((s) => s.squareId === id);
  const groups = PROPERTY_GROUPS.map((g) => ({
    groupId: g.groupId,
    owned: g.squares.filter(ownsSquare).length,
    size: g.squares.length,
  }));
  return {
    properties: mine.filter((s) => SquareConfigDataMap.get(s.squareId)?.type === SquareType.Property).length,
    fullSets: groups.filter((g) => g.owned === g.size).length,
    houses: mine.reduce((n, s) => n + (s.numHouses ?? 0), 0),
    stations: STATIONS.filter(ownsSquare).length,
    utilities: UTILITIES.filter(ownsSquare).length,
    mortgaged: mine.filter((s) => s.isMortgaged).length,
    groups,
  };
};

interface TurnSnapshot {
  turn: number;
  final: boolean;
  players: Array<{ _id: string; totalAssets: number }>;
}

/** A tiny line of one player's net worth over the last turns. */
const Sparkline: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  if (values.length < 2) {
    return null;
  }
  const W = 120, H = 34, pad = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (W - pad * 2),
    pad + (1 - (v - min) / span) * (H - pad * 2),
  ]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${H - pad} ${line} ${W - pad},${H - pad}`;
  const [ex, ey] = pts[pts.length - 1];
  return (
    <svg className="pstat-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polygon points={area} fill={color} opacity={0.12} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ex} cy={ey} r={2.75} fill={color} />
    </svg>
  );
};

export const StatsDialog: React.FC<Props> = ({ tradeWithPlayer }) => {

  const gameState = useGameStateStore(state => state.data);
  const statsViewOpen = useGameStateStore(state => state.statsViewOpen);
  const setStatsViewOpen = useGameStateStore(state => state.setStatsViewOpen);
  const [snapshots, setSnapshots] = useState<TurnSnapshot[]>([]);
  // phones get the whole screen: the cards need the width
  const fullScreen = useMediaQuery("(max-width: 600px)");
  // on phones each card shows the essentials; the rest opens per player
  const compact = fullScreen;
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});

  // the trend lines come from the game's turn-by-turn snapshots
  const gameId = gameState?._id;
  useEffect(() => {
    if (!statsViewOpen || !gameId) {
      return;
    }
    let live = true;
    API.post("getSnapshots", { gameId })
      .then((r) => { if (live) setSnapshots(r.data.snapshots ?? []); })
      .catch(() => { if (live) setSnapshots([]); });
    return () => { live = false; };
  }, [statsViewOpen, gameId]);

  const ranked = useMemo(() => {
    if (!gameState) return [];
    return [...gameState.players].sort((a, b) => {
      const ab = a.state === PlayerState.BANKRUPT, bb = b.state === PlayerState.BANKRUPT;
      if (ab !== bb) return ab ? 1 : -1;
      if (ab && bb) return (a.finishedRank ?? 99) - (b.finishedRank ?? 99);
      return b.totalAssets - a.totalAssets;
    });
  }, [gameState]);

  if (!gameState) {
    return null;
  }

  const me = getMyUserId();
  const active = ranked.filter((p) => p.state !== PlayerState.BANKRUPT);
  const tableWealth = active.reduce((n, p) => n + Math.max(0, p.totalAssets), 0);

  const historyOf = (playerId: string): number[] =>
    snapshots
      .map((s) => s.players.find((p) => areObjectIdsEqual(p._id, playerId))?.totalAssets)
      .filter((v): v is number => typeof v === "number");

  const canOfferTrade = (player: Player) => {
    if (areObjectIdsEqual(player._id, me) || player.state === PlayerState.BANKRUPT) {
      return false;
    }
    return !!(me && gameState.nextPlayerToAct && areObjectIdsEqual(me, gameState.nextPlayerToAct) && gameState.auctionId == null);
  };

  const money = (n: number | undefined) => (n == null ? "—" : dollarFormatter.format(n));

  const playerCard = (p: Player) => {
    const rank = active.indexOf(p) + 1;
    const bankrupt = p.state === PlayerState.BANKRUPT;
    const isMe = areObjectIdsEqual(p._id, me);
    const h = holdingsOf(gameState, p._id);
    const perTurn = p.taxesPerTurn + p.electricityCostsPerTurn;
    const covers = perTurn > 0 ? Math.max(0, Math.floor(p.money / perTurn)) : null;
    const history = historyOf(p._id);
    const trend = history.slice(-TREND_TURNS);
    const change = history.length > CHANGE_TURNS ? history[history.length - 1] - history[history.length - 1 - CHANGE_TURNS] : null;
    const s = p.stats;
    const showDetails = !compact || !!detailsOpen[p._id];
    const share = tableWealth > 0 && !bankrupt ? Math.round((Math.max(0, p.totalAssets) / tableWealth) * 100) : null;

    return (
      <article key={p._id} className={"pstat-card" + (bankrupt ? " bankrupt" : "") + (isMe ? " is-me" : "")} style={{ borderTopColor: p.color }}>
        <header className="pstat-head">
          <span className="pstat-rank" title={bankrupt ? "Out of the game" : "Rank by net worth"}>
            {bankrupt ? "Out" : "#" + rank}
          </span>
          <FontAwesomeIcon icon={getIconProp(p.type)} color={p.color} fixedWidth />
          <div className="pstat-name">
            <span style={{ color: p.color }}>
              {p.name}
              {compact && p.state === PlayerState.IN_ISOLATION && <> <FontAwesomeIcon icon={faBiohazard} color="#c62828" title="In quarantine" /></>}
            </span>
            {isMe && <span className="pstat-you">you</span>}
            {showDetails &&
              <small>
                {p.playerClass}
                {p.isBot && <> · <FontAwesomeIcon icon={faRobot} /> computer</>}
                {p.state === PlayerState.IN_ISOLATION && <> · <FontAwesomeIcon icon={faBiohazard} color="#c62828" /> in quarantine</>}
              </small>}
          </div>
          {canOfferTrade(p) &&
            <Button size="small" variant="outlined" className="pstat-trade" startIcon={<FontAwesomeIcon icon={faHandshake} />}
              onClick={() => { tradeWithPlayer(p); setStatsViewOpen(false); }}>
              Trade
            </Button>}
        </header>

        <div className="pstat-worth">
          <div>
            <div className="pstat-label">Net worth</div>
            <div className="pstat-big">{bankrupt ? "Bankrupt" : dollarFormatter.format(p.totalAssets)}</div>
            {change != null && !bankrupt &&
              <div className={"pstat-change " + (change > 0 ? "up" : change < 0 ? "down" : "flat")}>
                {change === 0
                  ? `No change in ${CHANGE_TURNS} turns`
                  : `${change > 0 ? "▲" : "▼"} ${dollarFormatter.format(Math.abs(change))} in ${CHANGE_TURNS} turns`}
              </div>}
          </div>
          <Sparkline values={trend} color={p.color} />
        </div>

        {compact && !bankrupt &&
          <p className="pstat-brief">
            {dollarFormatter.format(p.money)} cash
            {" · "}{h.properties} {h.properties === 1 ? "property" : "properties"}
            {h.fullSets > 0 && <>{" · "}{h.fullSets} {h.fullSets === 1 ? "set" : "sets"}</>}
            {share != null && <>{" · "}{share}% of table</>}
          </p>}

        {compact &&
          <button type="button" className="pstat-more" aria-expanded={showDetails}
            onClick={() => setDetailsOpen((d) => ({ ...d, [p._id]: !d[p._id] }))}>
            {showDetails ? "Hide details" : "Details"} <FontAwesomeIcon icon={faChevronDown} className={showDetails ? "flip" : undefined} />
          </button>}

        {showDetails && <>
        <dl className="pstat-row3">
          <div><dt>Cash</dt><dd>{dollarFormatter.format(p.money)}</dd></div>
          <div>
            <dt>Costs / turn</dt>
            <dd>
              {getTaxTooltip(gameState, p, dollarFormatter.format(p.taxesPerTurn))}
              <span className="pstat-plus"> + </span>
              {getElectricityTooltip(gameState, p, dollarFormatter.format(p.electricityCostsPerTurn))}
            </dd>
          </div>
          <div title="How many turns of tax and electricity their cash would cover, before salary">
            <dt>Cash covers</dt><dd>{covers == null ? "No costs" : covers + (covers === 1 ? " turn" : " turns")}</dd>
          </div>
        </dl>

        <div className="pstat-section">
          <div className="pstat-label">Holdings</div>
          <div className="pstat-groups" aria-label="Colour sets owned">
            {h.groups.map((g) => (
              <span key={g.groupId} className={"pstat-group" + (g.owned === g.size ? " full" : "")}
                title={`${g.owned} of ${g.size}` + (g.owned === g.size ? ": full set" : "")}>
                {Array.from({ length: g.size }).map((_, i) => (
                  <i key={i} className={i < g.owned ? squareGroupColorMap.get(g.groupId) : "empty"} />
                ))}
                {g.owned === g.size && <FontAwesomeIcon icon={faCheck} />}
              </span>
            ))}
            <span className="pstat-group icons" title={`${h.stations} of ${STATIONS.length} stations, ${h.utilities} of ${UTILITIES.length} utilities`}>
              <FontAwesomeIcon icon={faTrain} /> {h.stations}
              <FontAwesomeIcon icon={faBolt} /> {h.utilities}
            </span>
          </div>
          <p className="pstat-summary">
            {h.properties} {h.properties === 1 ? "property" : "properties"}
            {" · "}{h.fullSets} full {h.fullSets === 1 ? "set" : "sets"}
            {" · "}{h.houses} {h.houses === 1 ? "house" : "houses"}
            {h.mortgaged > 0 && <>{" · "}{h.mortgaged} mortgaged</>}
          </p>
        </div>

        <dl className="pstat-record">
          <div><dt>Rent collected</dt><dd>{money(s?.rentCollected)}</dd></div>
          <div><dt>Rent paid</dt><dd>{money(s?.rentPaid)}</dd></div>
          <div><dt>Auctions won</dt><dd>{s ? `${s.auctionsWon} · ${dollarFormatter.format(s.auctionSpend)}` : "—"}</dd></div>
          <div><dt>Paydays</dt><dd>{s ? s.paydays : "—"}</dd></div>
          <div><dt>Lotto winnings</dt><dd>{money(s?.lottoWinnings)}</dd></div>
          <div><dt>Could raise</dt><dd title="Cash available by mortgaging everything not yet mortgaged">{dollarFormatter.format(p.mortgageableValue)}</dd></div>
          <div><dt>To redeem all</dt><dd title="Cost to pay off every mortgage">{dollarFormatter.format(p.redeemableValue)}</dd></div>
          <div><dt>Skills</dt><dd title="Negotiation · Luck · Corruption">{p.negotiation} · {p.luck} · {p.corruption}</dd></div>
        </dl>
        </>}
      </article>
    );
  };

  return (
    <Dialog fullWidth={true} maxWidth="lg" fullScreen={fullScreen} className="pstat-dialog"
      onClose={() => setStatsViewOpen(false)} aria-labelledby="stats-dialog-title" open={statsViewOpen}>
      <DialogTitle id="stats-dialog-title">
        Players
        <span className="pstat-turn">Turn {gameState.turnNumber ?? 0}</span>
      </DialogTitle>
      <DialogContent>
        {tableWealth > 0 &&
          <div className="pstat-share">
            <div className="pstat-label">Share of the table's net worth</div>
            <div className="pstat-share-bar" role="img"
              aria-label={active.map((p) => `${p.name} ${Math.round((Math.max(0, p.totalAssets) / tableWealth) * 100)}%`).join(", ")}>
              {active.map((p) => (
                <span key={p._id} style={{ background: p.color, flexGrow: Math.max(0, p.totalAssets) }}
                  title={`${p.name}: ${Math.round((Math.max(0, p.totalAssets) / tableWealth) * 100)}%`} />
              ))}
            </div>
            {!compact && <ul className="pstat-share-legend">
              {active.map((p) => (
                <li key={p._id}><i style={{ background: p.color }} />{p.name} <b>{Math.round((Math.max(0, p.totalAssets) / tableWealth) * 100)}%</b></li>
              ))}
            </ul>}
          </div>}

        <div className="pstat-grid">
          {ranked.map(playerCard)}
        </div>
        <p className="pstat-foot">Rent, auctions, paydays and lotto are counted from when this was added, so games started earlier show partial totals or a dash.</p>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setStatsViewOpen(false)} color="primary">Close</Button>
      </DialogActions>
    </Dialog>
  );

};
