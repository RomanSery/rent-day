// Bot-versus-bot simulation. Plays many games with only computer players
// and reports how each skill level fares. Run the Worker in development
// mode with no bot pacing:
//
//   npx wrangler dev --var DEV_BOT_PACE_MS:0
//   GAMES=20 LEVELS=Normal,Normal,Easy,Easy node test/sim.mjs
//
// Use it to compare rule changes: run it before and after, same seat mix.

const BASE = process.env.BASE || "http://localhost:8787";
const GAMES = parseInt(process.env.GAMES || "20", 10);
const LEVELS = (process.env.LEVELS || "Normal,Normal,Easy,Easy").split(",").map((s) => s.trim());
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || "240000", 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const post = async (path, body) => {
  const r = await fetch(BASE + "/api/" + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; } catch { return { status: r.status, data: text }; }
};

const started = Date.now();
console.log(`starting ${GAMES} games with seats [${LEVELS.join(", ")}] against ${BASE}`);

const games = [];
for (let i = 0; i < GAMES; i++) {
  const r = await post("dev/simulate", { levels: LEVELS });
  if (r.status !== 200) {
    console.log("could not start a simulation:", r.status, r.data);
    process.exit(1);
  }
  games.push({ id: r.data.gameId, done: false, startedAt: Date.now() });
}

const results = [];
while (games.some((g) => !g.done) && Date.now() - started < TIMEOUT_MS) {
  await sleep(500);
  for (const g of games) {
    if (g.done) continue;
    const r = await post("dev/game", { gameId: g.id });
    const game = r.data?.game;
    if (!game) continue;
    g.turns = game.turnNumber ?? 0;
    if (game.status === "Finished") {
      g.done = true;
      results.push({ game, seconds: (Date.now() - g.startedAt) / 1000 });
    }
  }
}

const stalled = games.filter((g) => !g.done);
console.log(`\n${results.length} finished, ${stalled.length} unfinished after ${Math.round((Date.now() - started) / 1000)}s`);
if (stalled.length) {
  console.log("  unfinished:", stalled.map((g) => `${g.id.slice(-4)}@turn${g.turns}`).join(", "));
}

const byLevel = new Map();
for (const level of LEVELS) {
  if (!byLevel.has(level)) byLevel.set(level, { seats: 0, wins: 0, assets: 0, rankSum: 0 });
  byLevel.get(level).seats += LEVELS.filter((l) => l === level).length / LEVELS.filter((l) => l === level).length;
}
// seats per level per game
const seatsPerLevel = new Map();
for (const level of LEVELS) seatsPerLevel.set(level, (seatsPerLevel.get(level) ?? 0) + 1);

let totalTurns = 0, totalSeconds = 0, byAssets = 0, byElimination = 0;
for (const { game, seconds } of results) {
  totalTurns += game.turnNumber ?? 0;
  totalSeconds += seconds;
  const activeAtEnd = game.players.filter((p) => p.state !== "Bankrupt").length;
  if (activeAtEnd > 1) byAssets++; else byElimination++;
  for (const p of game.players) {
    const s = byLevel.get(p.botLevel) ?? byLevel.set(p.botLevel, { seats: 0, wins: 0, assets: 0, rankSum: 0 }).get(p.botLevel);
    s.assets += p.totalAssets;
    s.rankSum += p.finishedRank ?? game.players.length;
    if (game.winner === p.name) s.wins++;
  }
}

console.log(`average length ${results.length ? Math.round(totalTurns / results.length) : 0} turns, ${results.length ? (totalSeconds / results.length).toFixed(1) : 0}s wall time`);
console.log(`ended by elimination: ${byElimination}, by the turn cap (ranked by assets): ${byAssets}`);
console.log("\nlevel     seats/game  win rate   avg rank  avg final assets");
for (const [level, s] of byLevel) {
  const seats = seatsPerLevel.get(level) ?? 0;
  const played = seats * results.length;
  if (!played) continue;
  const winRate = (s.wins / results.length) * 100; // share of games won by this level
  const fair = (seats / LEVELS.length) * 100;
  console.log(
    `${level.padEnd(9)} ${String(seats).padStart(6)}      ${winRate.toFixed(0).padStart(3)}% (fair ${fair.toFixed(0)}%)   ${(s.rankSum / played).toFixed(2)}     $${Math.round(s.assets / played)}`
  );
}
process.exit(stalled.length ? 1 : 0);
