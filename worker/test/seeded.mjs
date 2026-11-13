// Seeded games: two bots-only games with the same seed must play out exactly
// the same, turn by turn, and a different seed must not. Also checks the
// generator's state never reaches players and the seed only once a game ends.
// Run the Worker with fast bots:
//
//   npx wrangler dev --var DEV_BOT_PACE_MS:0
//   node test/seeded.mjs

const BASE = process.env.BASE || "http://localhost:8787";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (cond, msg) => {
  console.log((cond ? "  ok   " : "  FAIL ") + msg);
  if (!cond) failures++;
};

let cookie = "";
const post = async (path, body) => {
  const r = await fetch(BASE + "/api/" + path, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body ?? {}),
  });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  if (sc.length) cookie = sc.map((s) => s.split(";")[0]).join("; ");
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; } catch { return { status: r.status, data: text }; }
};

const u = ("seed" + Date.now().toString(36)).slice(0, 10);
const acct = await post("createAccount", { email: `${u}@t.com`, username: u, password: "pw-test-1", confirmPassword: "pw-test-1" });
if (acct.status !== 200) throw new Error("createAccount failed: " + JSON.stringify(acct.data));

const LEVELS = ["Normal", "Normal", "Easy", "Easy"];
const start = async (seed) => {
  const r = await post("dev/simulate", { levels: LEVELS, seed });
  if (r.status !== 200) throw new Error("simulate failed: " + JSON.stringify(r.data));
  return r.data.gameId;
};

const SEED = 12345;
const ids = [await start(SEED), await start(SEED), await start(SEED + 1)];
console.log("playing three bots-only games:", ids.map((id) => id.slice(-4)).join(", "));

const early = (await post("dev/game", { gameId: ids[0] })).data.game;
check(early && !("rngState" in early) && early.seed === undefined, "players see neither the generator state nor the seed mid-game");

const finished = new Map();
const started = Date.now();
while (finished.size < ids.length && Date.now() - started < 300000) {
  for (const id of ids) {
    if (finished.has(id)) continue;
    const g = (await post("dev/game", { gameId: id })).data.game;
    if (g?.status === "Finished") finished.set(id, g);
  }
  await sleep(500);
}
check(finished.size === ids.length, "all three games finished");
const [a, b, c] = ids.map((id) => finished.get(id));
if (!a || !b || !c) process.exit(1);

check(a.seed === SEED && !("rngState" in a), "the seed is shown once the game is over, the state never");

// a game boiled down to what the dice decided (ids differ between games)
const outcome = (g) => ({
  turns: g.turnNumber,
  winner: g.winner,
  players: g.players.map((p) => [p.name, p.playerClass, p.money, p.totalAssets, p.position, p.state, p.finishedRank]),
  squares: g.squareState.map((s) => [s.squareId, g.players.findIndex((p) => p._id === s.owner), s.numHouses, s.isMortgaged]),
});
const same = JSON.stringify(outcome(a)) === JSON.stringify(outcome(b));
check(same, `same seed, same game (${a.turnNumber} turns, winner ${a.winner})`);

const snaps = async (id) => (await post("getSnapshots", { gameId: id })).data.snapshots;
const strip = (s) => JSON.stringify([s.turn, s.players.map((p) => [p.money, p.position, p.state]), s.squares.map((q) => [q.squareId, q.numHouses])]);
const [sa, sb] = [await snaps(ids[0]), await snaps(ids[1])];
const firstDiff = sa.findIndex((s, i) => !sb[i] || strip(s) !== strip(sb[i]));
check(sa.length === sb.length && firstDiff === -1,
  firstDiff === -1 ? `every one of ${sa.length} snapshots matches` : `snapshots differ from turn ${sa[firstDiff].turn}`);

check(JSON.stringify(outcome(a)) !== JSON.stringify(outcome(c)), `a different seed plays differently (${c.turnNumber} turns, winner ${c.winner})`);

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
