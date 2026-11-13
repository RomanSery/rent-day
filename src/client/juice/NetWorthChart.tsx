import React, { useEffect, useMemo, useState } from "react";
import API from "../api";
import { Player } from "../../core/types/Player";
import { dollarFormatter } from "../helpers";

/** One turn of a game as /api/getSnapshots returns it. */
interface TurnSnapshot {
  turn: number;
  final: boolean;
  players: Array<{ _id: string; totalAssets: number }>;
}

interface Props {
  gameId: string;
  players: Player[];
}

// drawing area, in viewBox units
const W = 640;
const H = 260;
const M = { top: 12, right: 16, bottom: 28, left: 56 };
const MAX_POINTS = 240;

const compact = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return (n < 0 ? "-" : "") + "$" + (abs / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
  }
  return dollarFormatter.format(n);
};

/** round numbers for the y axis, from 0 to just past max */
const niceTicks = (max: number): number[] => {
  if (max <= 0) return [0];
  const rough = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? rough;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
};

/** Each player's net worth (cash plus what their property would sell for) over the game. */
export const NetWorthChart: React.FC<Props> = ({ gameId, players }) => {
  const [snapshots, setSnapshots] = useState<TurnSnapshot[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    API.post("getSnapshots", { gameId })
      .then((response) => { if (live) setSnapshots(response.data.snapshots ?? []); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [gameId]);

  const chart = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return null;
    // keep the chart light on long games: every k-th turn, always the last
    const k = Math.ceil(snapshots.length / MAX_POINTS);
    const points = snapshots.filter((_, i) => i % k === 0 || i === snapshots.length - 1);
    const lastTurn = points[points.length - 1].turn || points.length - 1;
    const values = points.flatMap((s) => s.players.map((p) => p.totalAssets));
    const ticks = niceTicks(Math.max(...values, 0));
    const yMax = ticks[ticks.length - 1] || 1;
    const x = (turn: number) => M.left + (turn / Math.max(1, lastTurn)) * (W - M.left - M.right);
    const y = (v: number) => M.top + (1 - Math.max(0, v) / yMax) * (H - M.top - M.bottom);

    const series = players.map((pl) => {
      const pts = points
        .map((s, i) => {
          const entry = s.players.find((p) => p._id === pl._id);
          // the final snapshot shares the last turn's number: nudge it to the end
          const turn = s.final ? lastTurn : Math.min(s.turn, lastTurn);
          return entry ? { x: x(i === points.length - 1 ? lastTurn : turn), y: y(entry.totalAssets), v: entry.totalAssets } : null;
        })
        .filter((p): p is { x: number; y: number; v: number } => p !== null);
      return { player: pl, pts };
    }).filter((s) => s.pts.length > 1);

    const xTicks = [0, Math.round(lastTurn / 2), lastTurn].filter((t, i, a) => a.indexOf(t) === i);
    return { series, ticks, y, x, xTicks };
  }, [snapshots, players]);

  if (failed) {
    return null;
  }
  if (!snapshots) {
    return <p className="networth-note">Loading the game&rsquo;s history&hellip;</p>;
  }
  if (!chart || chart.series.length === 0) {
    return <p className="networth-note">No turn-by-turn history was kept for this game.</p>;
  }

  const ranked = [...chart.series].sort((a, b) => (a.player.finishedRank ?? 99) - (b.player.finishedRank ?? 99));

  return (
    <figure className="networth">
      <figcaption>Net worth by turn</figcaption>
      <div className="networth-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart of each player's net worth over the game">
          {chart.ticks.map((t) => (
            <g key={"y" + t}>
              <line x1={M.left} x2={W - M.right} y1={chart.y(t)} y2={chart.y(t)} className={t === 0 ? "axis" : "grid"} />
              <text x={M.left - 8} y={chart.y(t)} className="tick" textAnchor="end" dominantBaseline="middle">{compact(t)}</text>
            </g>
          ))}
          {chart.xTicks.map((t) => (
            <text key={"x" + t} x={chart.x(t)} y={H - 8} className="tick" textAnchor={t === 0 ? "start" : t === chart.xTicks[chart.xTicks.length - 1] ? "end" : "middle"}>
              {t === 0 ? "Turn 0" : "Turn " + t}
            </text>
          ))}
          {chart.series.map(({ player, pts }) => (
            <polyline key={player._id} points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
              fill="none" stroke={player.color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {chart.series.map(({ player, pts }) => {
            const end = pts[pts.length - 1];
            return <circle key={player._id + "-end"} cx={end.x} cy={end.y} r={4} fill={player.color} stroke="#fff" strokeWidth={1.5} />;
          })}
        </svg>
      </div>
      <ul className="networth-legend">
        {ranked.map(({ player, pts }) => (
          <li key={player._id}>
            <span className="swatch" style={{ background: player.color }} />
            <span className="name">{player.name}</span>
            <span className="value">{dollarFormatter.format(pts[pts.length - 1].v)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
};
