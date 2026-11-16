// Neighborhood events: forced events change rent on their block (rezoning up,
// water main down), landmark status blocks building, a lockdown stops rent and
// fines visitors, events end on schedule, and a bots-only game starts them on
// its own.
//
// Start the Worker with fast bots for the last part:
//   npx wrangler dev --var DEV_BOT_PACE_MS:30

const BASE = process.env.BASE || "http://localhost:8787";
const WS_BASE = BASE.replace(/^http/, "ws");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (cond, msg) => {
  console.log((cond ? "  ok   " : "  FAIL ") + msg);
  if (!cond) failures++;
};
const section = (t) => console.log("\n" + t);

class Client {
  constructor(name) { this.name = name; this.cookie = ""; }
  async post(path, body) {
    const r = await fetch(BASE + "/api/" + path, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: this.cookie },
      body: JSON.stringify(body ?? {}),
    });
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    if (sc.length) this.cookie = sc.map((s) => s.split(";")[0]).join("; ");
    const text = await r.text();
    try { return { status: r.status, data: JSON.parse(text) }; } catch { return { status: r.status, data: text }; }
  }
  connect(gameId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_BASE + "/ws?gameId=" + gameId, { headers: { cookie: this.cookie } });
      ws.addEventListener("open", () => resolve(ws));
      ws.addEventListener("error", (e) => reject(e.error || new Error("ws error")));
      this.ws = ws;
    });
  }
}

const GOVERNORS_ISLAND = 5; // a colour group of one: owning it allows building
const ISLAND_GROUP = 15;
const STATION_GROUP = 10;

const suffix = Date.now().toString(36).slice(-5);
let n = 0;
const getGame = async (c, gameId) => (await c.post("getGame", { gameId })).data.game;
const force = (c, gameId, kind, groupId) => c.post("dev/neighborhoodEvent", { gameId, kind, groupId });

/** Two players; the first to act buys Governors Island at auction and ends their turn. */
const setup = async () => {
  const a = new Client("a"), b = new Client("b");
  const s = suffix + n++;
  let r = await a.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email: `na${s}@t.com`, username: `na${s}`.slice(0, 10), password: "pw-test-1", confirmPassword: "pw-test-1" });
  a.id = r.data.id;
  r = await b.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email: `nb${s}@t.com`, username: `nb${s}`.slice(0, 10), password: "pw-test-1", confirmPassword: "pw-test-1" });
  b.id = r.data.id;
  r = await a.post("createGame", { data: { gameName: "News " + s, maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, useTimers: false }, context: {} });
  const gameId = r.data.gameId;
  await a.connect(gameId); await b.connect(gameId);
  await a.post("joinGame", { gameId, piece: "Car", playerClass: "Banker" });
  // the same class for both, so whoever buys the island charges the same base rent
  await b.post("joinGame", { gameId, piece: "Dog", playerClass: "Banker" });
  let game = await getGame(a, gameId);
  const owner = game.nextPlayerToAct === a.id ? a : b;
  const visitor = owner === a ? b : a;

  await owner.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 3 });
  await owner.post("actions/bid", { context: { gameId }, bid: 100 });
  await visitor.post("actions/bid", { context: { gameId }, bid: 0 });
  game = await getGame(a, gameId);
  const owned = game.squareState.find((x) => x.squareId === GOVERNORS_ISLAND)?.owner === owner.id;
  r = await owner.post("actions/completeTurn", { context: { gameId } });
  return { a, b, gameId, owner, visitor, owned: owned && r.status === 200 };
};

/** The visitor lands on Governors Island; returns the rent they paid. */
const visit = async ({ gameId, visitor }) => {
  await visitor.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 3 });
  const game = await getGame(visitor, gameId);
  return game.lastRent?.squareId === GOVERNORS_ISLAND ? game.lastRent.amount : null;
};

const close = (g) => { g.a.ws.close(); g.b.ws.close(); };
const near = (actual, expected) => actual != null && Math.abs(actual - expected) <= 1;

// --- rent ------------------------------------------------------------------------
section("rent with and without an event");
const plain = await setup();
check(plain.owned, "owner bought Governors Island at auction");
const baseRent = await visit(plain);
check(baseRent > 0, "rent with no event: $" + baseRent);
const build = await plain.owner.post("actions/buildHouse", { context: { gameId: plain.gameId }, squareId: GOVERNORS_ISLAND });
check(build.status === 200, "with no event the owner can build -> " + build.status + " " + JSON.stringify(build.data));
close(plain);

{
  const g = await setup();
  const r = await force(g.owner, g.gameId, "rezoning", ISLAND_GROUP);
  check(r.status === 200 && r.data.event?.groupId === ISLAND_GROUP, "rezoning forced on Governors Island: " + JSON.stringify(r.data));
  const game = await getGame(g.a, g.gameId);
  check(game.neighborhoodEvents?.length === 1 && game.neighborhoodEvents[0].kind === "rezoning", "event is on the game players see");
  check(!("nextNeighborhoodEventTurn" in game), "when the next event is due is not sent to players");
  check(/City news.*Rezoning.*Governors Island/.test(game.log.at(-1)?.msg ?? ""), "log announces it: " + game.log.at(-1)?.msg);
  const rent = await visit(g);
  check(near(rent, baseRent * 1.5), `rezoning: rent $${rent}, about 1.5 x $${baseRent}`);
  close(g);
}

{
  const g = await setup();
  await force(g.owner, g.gameId, "waterMain", ISLAND_GROUP);
  const rent = await visit(g);
  check(near(rent, baseRent * 0.5), `water main break: rent $${rent}, about half of $${baseRent}`);
  close(g);
}

// --- landmark status ------------------------------------------------------------
section("landmark status");
{
  const g = await setup();
  await force(g.owner, g.gameId, "landmark", ISLAND_GROUP);
  const r = await g.owner.post("actions/buildHouse", { context: { gameId: g.gameId }, squareId: GOVERNORS_ISLAND });
  check(r.status !== 200 && /landmark/i.test(JSON.stringify(r.data)), "building is refused: " + JSON.stringify(r.data));
  const rent = await visit(g);
  check(near(rent, baseRent * 1.25), `landmark: rent $${rent}, about 1.25 x $${baseRent}`);
  close(g);
}

// --- lockdown ---------------------------------------------------------------------
section("lockdown");
{
  const g = await setup();
  const r = await force(g.owner, g.gameId, "lockdown", ISLAND_GROUP);
  check(r.status === 200 && r.data.event?.kind === "lockdown", "lockdown forced on Governors Island");
  const b = await g.owner.post("actions/buildHouse", { context: { gameId: g.gameId }, squareId: GOVERNORS_ISLAND });
  check(b.status !== 200 && /Lockdown/.test(JSON.stringify(b.data)), "building is refused: " + JSON.stringify(b.data));
  const before = (await getGame(g.visitor, g.gameId)).players.find((p) => p._id === g.visitor.id).money;
  const rent = await visit(g);
  const game = await getGame(g.visitor, g.gameId);
  const after = game.players.find((p) => p._id === g.visitor.id).money;
  check(rent == null, "no rent is paid on a locked-down block");
  check(before - after === 50, `the visitor is fined $50 for travelling there ($${before} -> $${after})`);
  check(/Fined \$50 for non-essential travel/.test(game.log.at(-1)?.msg ?? ""), "the log says why: " + game.log.at(-1)?.msg);
  close(g);
}

// --- targets, overlap and ending ------------------------------------------------
section("targets, overlap and ending");
{
  const g = await setup();
  let r = await force(g.owner, g.gameId, "subwayWork", ISLAND_GROUP);
  check(r.status === 200 && r.data.event?.groupId === STATION_GROUP, "subway work always lands on the stations: group " + r.data.event?.groupId);
  r = await force(g.owner, g.gameId, "rezoning", STATION_GROUP);
  check(r.status === 200 && r.data.event?.groupId !== STATION_GROUP, "a rezoning can't land on the stations: group " + r.data.event?.groupId);
  r = await force(g.owner, g.gameId, "waterMain", r.data.event?.groupId);
  check(r.status === 200, "a second event on a busy block goes elsewhere");
  let game = await getGame(g.a, g.gameId);
  const groups = game.neighborhoodEvents.map((e) => e.groupId);
  check(new Set(groups).size === groups.length, "never two events on one block: " + groups.join(","));

  const last = Math.max(...game.neighborhoodEvents.map((e) => e.endsAtTurn));
  const players = { [g.a.id]: g.a, [g.b.id]: g.b };
  for (let guard = 0; guard < 30 && (game.turnNumber ?? 0) < last; guard++) {
    const cur = players[game.nextPlayerToAct];
    const me = game.players.find((p) => p._id === cur.id);
    if (!me.hasRolled) {
      await cur.post("actions/roll", { context: { gameId: g.gameId }, forceDie1: 1, forceDie2: 2 });
      game = await getGame(cur, g.gameId);
      if (game.auctionId) {
        await g.a.post("actions/bid", { context: { gameId: g.gameId }, bid: 0 });
        await g.b.post("actions/bid", { context: { gameId: g.gameId }, bid: 0 });
      }
      if (game.pendingChance) await cur.post("actions/chanceChoice", { context: { gameId: g.gameId }, choice: game.pendingChance.choices[0].key });
      if (game.lottoId) await cur.post("actions/pickLotto", { context: { gameId: g.gameId }, opt: 1 });
    }
    await cur.post("actions/completeTurn", { context: { gameId: g.gameId } });
    game = await getGame(cur, g.gameId);
  }
  const forced = game.neighborhoodEvents.filter((e) => e.id <= 3);
  check(forced.length === 0, "the forced events are over by turn " + last + " (now turn " + game.turnNumber + ")");
  check(game.log.filter((m) => /City news.* is over/.test(m.msg)).length >= 3, "the log says each one ended");
  close(g);
}

// --- events start on their own --------------------------------------------------
section("a bots-only game starts events on its own");
{
  // Watch up to three games, moving on from one whose turn stops advancing,
  // so a stuck bot shows up as a note here rather than a long wait.
  const sim = new Client("sim");
  let maxActive = 0, minStart = Infinity, started = [], lastTurn = 0;
  for (let attempt = 0; attempt < 3 && started.length === 0; attempt++) {
    const r = await sim.post("dev/simulate", { levels: ["Normal", "Normal", "Normal"], seed: "neighborhood-" + suffix + "-" + attempt });
    check(r.status === 200, "simulation started -> " + r.status);
    const gameId = r.data.gameId;
    let game = null, still = 0;
    const until = Date.now() + 120000;
    while (Date.now() < until) {
      game = (await sim.post("dev/game", { gameId })).data.game;
      if (!game) break;
      (game.neighborhoodEvents ?? []).forEach((e) => { minStart = Math.min(minStart, e.startTurn); });
      maxActive = Math.max(maxActive, game.neighborhoodEvents?.length ?? 0);
      still = game.turnNumber === lastTurn ? still + 1 : 0;
      lastTurn = game.turnNumber ?? 0;
      if (lastTurn >= 60 || game.status === "Finished" || still >= 16) break;
      await sleep(250);
    }
    started = (game?.log ?? []).filter((m) => /City news<\/b> - [^:]+:/.test(m.msg));
    if (still >= 16) console.log(`    (game ${attempt + 1} stalled at turn ${lastTurn})`);
  }
  check(started.length > 0, `events started on their own by turn ${lastTurn}: ${started.length} in the log`);
  check(maxActive <= 2, "at most two at once (saw " + maxActive + ")");
  if (started[0]) console.log("    first: " + started[0].msg.replace(/<[^>]+>/g, ""));
  check(minStart >= 9, "none in the first three rounds (earliest seen started on turn " + minStart + ")");
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
