// Per-turn snapshots and the clean-up of finished games. Plays one bots-only
// game to the end, checks there is one snapshot per turn plus a final one,
// reports their size, then waits for the finished game to be deleted.
// Run the Worker with fast bots and a short clean-up delay:
//
//   npx wrangler dev --var DEV_BOT_PACE_MS:0 --var DEV_PURGE_SECONDS:20
//   node test/snapshots.mjs

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

const u = ("snap" + Date.now().toString(36)).slice(0, 10);
const acct = await post("createAccount", { email: `${u}@t.com`, username: u, password: "pw-test-1", confirmPassword: "pw-test-1" });
if (acct.status !== 200) throw new Error("createAccount failed: " + JSON.stringify(acct.data));

const sim = await post("dev/simulate", { levels: ["Normal", "Normal", "Easy", "Easy"] });
if (sim.status !== 200) throw new Error("simulate failed: " + JSON.stringify(sim.data));
const gameId = sim.data.gameId;
console.log("playing bots-only game", gameId);

let game = null;
const started = Date.now();
while (Date.now() - started < 240000) {
  game = (await post("dev/game", { gameId })).data.game;
  if (game?.status === "Finished") break;
  await sleep(500);
}
check(game?.status === "Finished", `game finished (turn ${game?.turnNumber})`);

const { snapshots } = (await post("getSnapshots", { gameId })).data;
const numbered = snapshots.filter((s) => !s.final);
const finalSnap = snapshots[snapshots.length - 1];
check(numbered.length === game.turnNumber + 1, `one snapshot per turn: ${numbered.length} for turns 0..${game.turnNumber}`);
check(numbered.every((s, i) => s.turn === i), "snapshots are in turn order with no gaps");
check(finalSnap?.final === true, "the final snapshot comes last");
check(
  game.players.every((p) => finalSnap.players.find((q) => q._id === p._id)?.money === p.money),
  "final snapshot money matches the finished game"
);
const first = numbered[0];
check(first.squares.length === 0 && first.players.every((p) => p.position === 1), "turn 0 is the starting board");

// storage size, as stored (compact JSON)
const compact = (s) => {
  const seat = (id) => game.players.findIndex((p) => p._id === id);
  return JSON.stringify([s.turn, seat(s.nextPlayerToAct), s.players.map((p) => [p.money, p.position, p.totalAssets, 0]),
    s.squares.map((q) => [q.squareId, seat(q.owner), q.numHouses, q.isMortgaged ? 1 : 0])]);
};
const bytes = snapshots.reduce((n, s) => n + compact(s).length, 0);
const fullGameBytes = JSON.stringify(game).length;
console.log(`  snapshots: ${snapshots.length}, ${(bytes / 1024).toFixed(1)} KB total, ${Math.round(bytes / snapshots.length)} bytes each`);
console.log(`  (for comparison, one full copy of the finished game is ${(fullGameBytes / 1024).toFixed(1)} KB)`);

console.log("waiting for the finished game to be deleted...");
let gone = false;
const waitStart = Date.now();
while (Date.now() - waitStart < 90000) {
  const g = (await post("dev/game", { gameId })).data.game;
  if (!g) { gone = true; break; }
  await sleep(2000);
}
check(gone, "finished game deleted after the clean-up delay");
const after = (await post("getSnapshots", { gameId })).data.snapshots;
check(Array.isArray(after) && after.length === 0, "its snapshots are gone too");

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
