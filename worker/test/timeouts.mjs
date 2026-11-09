// Turn-timer scenarios. The Worker must run in development mode with short
// timers, e.g.  npx wrangler dev --var DEV_TURN_SECONDS:6 --var DEV_AUCTION_SECONDS:6
//
//   npm run test:api:timers   (or BASE=http://... node test/timeouts.mjs)

const BASE = process.env.BASE || "http://localhost:8787";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
let checks = 0;
const check = (cond, msg) => {
  checks++;
  console.log((cond ? "  ok   " : "  FAIL ") + msg);
  if (!cond) failures++;
};
const section = (t) => console.log("\n== " + t);

class Client {
  constructor(name) { this.name = name; this.cookie = ""; this.id = null; }
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
}

const suffix = Date.now().toString(36).slice(-5);
let n = 0;
const newUser = async (label) => {
  const c = new Client(label);
  const u = `${label}${suffix}${n++}`.slice(0, 10);
  const r = await c.post("createAccount", { email: `${u}@t.com`, username: u, password: "pw", confirmPassword: "pw" });
  if (r.status !== 200) throw new Error("createAccount failed: " + JSON.stringify(r.data));
  c.id = r.data.id;
  c.username = u;
  return c;
};

const ctx = (gameId) => ({ context: { gameId } });
const getGame = async (c, gameId) => (await c.post("getGame", { gameId })).data.game;
const playerOf = (game, c) => game.players.find((p) => p._id === c.id);
const square = (game, id) => game.squareState.find((s) => s.squareId === id);

const CHANCE = new Set([3, 8, 23, 33]);
const LOTTO = new Set([13, 28, 39]);
const safeSum = (pos, avoid = new Set()) => {
  for (const sum of [3, 5, 7, 9, 11]) {
    const land = ((pos - 1 + sum) % 40) + 1;
    if (land === 31 || CHANCE.has(land) || LOTTO.has(land) || avoid.has(land)) continue;
    return sum;
  }
  return 3;
};
const splitDice = (sum) => {
  for (let d1 = 1; d1 <= 6; d1++) {
    const d2 = sum - d1;
    if (d2 >= 1 && d2 <= 6 && d1 !== d2) return [d1, d2];
  }
  return [1, 1];
};

const waitForDeadline = async (iso, extraMs = 700) => {
  const ms = new Date(iso).getTime() - Date.now() + extraMs;
  if (ms > 0) await sleep(ms);
};

/** Active player Y takes a quick harmless turn (bids 0 in auctions). */
const activeTurn = async (gameId, Y, others) => {
  let g = await getGame(Y, gameId);
  const me = playerOf(g, Y);
  if (!me.hasRolled) {
    const owned = new Set(g.squareState.filter((s) => s.owner && s.owner !== Y.id).map((s) => s.squareId));
    const [d1, d2] = splitDice(safeSum(me.position, owned));
    await Y.post("actions/roll", { ...ctx(gameId), forceDie1: d1, forceDie2: d2 });
    g = await getGame(Y, gameId);
    if (g.auctionId) {
      await Y.post("actions/bid", { ...ctx(gameId), bid: 0 });
      // the idle player never bids: wait for the auction to time out
      const auction = (await Y.post("getAuction", { ...ctx(gameId), auctionId: g.auctionId })).data.auction;
      await waitForDeadline(auction.endsAt);
      await Y.post("actions/timesUpAction", ctx(gameId));
      g = await getGame(Y, gameId);
    }
  }
  await Y.post("actions/completeTurn", ctx(gameId));
  return getGame(Y, gameId);
};

/** Let the timer act for the idle player X once; resolves any auction too. */
const idleTimeout = async (gameId, Y) => {
  let g = await getGame(Y, gameId);
  await waitForDeadline(g.nextPlayerActBy);
  let r = await Y.post("actions/timesUpAction", ctx(gameId));
  g = await getGame(Y, gameId);
  if (g.auctionId) {
    // X was auto-rolled onto an unowned square; Y bids 0, X never bids
    await Y.post("actions/bid", { ...ctx(gameId), bid: 0 });
    const auction = (await Y.post("getAuction", { ...ctx(gameId), auctionId: g.auctionId })).data.auction;
    await waitForDeadline(auction.endsAt);
    await Y.post("actions/timesUpAction", ctx(gameId));
    g = await getGame(Y, gameId);
  }
  return { game: g, response: r };
};

// =========================================================================
section("sanity: short timers are active");
const X = await newUser("x"); // the idle player
const Y = await newUser("y"); // the active player
let r = await X.post("createGame", { data: { gameName: "Timeouts", maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, useTimers: true }, context: {} });
const gameId = r.data.gameId;
await X.post("joinGame", { gameId, piece: "Car", playerClass: "Gambler" });
await Y.post("joinGame", { gameId, piece: "Dog", playerClass: "Banker" });
let g = await getGame(Y, gameId);
const secondsLeft = (new Date(g.nextPlayerActBy).getTime() - Date.now()) / 1000;
check(secondsLeft > 0 && secondsLeft < 30, `turn deadline is short (${secondsLeft.toFixed(1)}s) -> timers overridden`);
if (secondsLeft >= 30) {
  console.log("Start the Worker with --var DEV_TURN_SECONDS:6 --var DEV_AUCTION_SECONDS:6");
  process.exit(1);
}

section("a timed-out player in debt mortgages what they own");
{
  // X buys square 6 (station, 1.8% tax) for almost all their money
  if (g.nextPlayerToAct === Y.id) g = await activeTurn(gameId, Y, [X]);
  r = await X.post("actions/roll", { ...ctx(gameId), forceDie1: 2, forceDie2: 3 }); // 1 -> 6
  check(r.status === 200, "X lands on station 6");
  r = await X.post("actions/bid", { ...ctx(gameId), bid: 1500 });
  r = await Y.post("actions/bid", { ...ctx(gameId), bid: 1450 });
  g = await getGame(X, gameId);
  check(square(g, 6).owner === X.id && square(g, 6).purchasePrice === 1450, "X pays Y's bid of 1450 for the station");
  check(playerOf(g, X).money === 50, "X has $50 left");
  check(playerOf(g, X).taxesPerTurn === 26, "tax per turn is 26 (1.8% of 1450)");
  await X.post("actions/completeTurn", ctx(gameId));
  g = await activeTurn(gameId, Y, [X]);
  check(playerOf(g, X).money === 24, "taxes charged when X's turn starts -> " + playerOf(g, X).money);
  // X acts normally once more (cheap non-double roll avoiding Y's squares)
  {
    const owned = new Set(g.squareState.filter((s) => s.owner && s.owner !== X.id).map((s) => s.squareId));
    const [d1, d2] = splitDice(safeSum(playerOf(g, X).position, owned));
    await X.post("actions/roll", { ...ctx(gameId), forceDie1: d1, forceDie2: d2 });
    g = await getGame(X, gameId);
    if (g.auctionId) { await X.post("actions/bid", { ...ctx(gameId), bid: 0 }); await Y.post("actions/bid", { ...ctx(gameId), bid: 0 }); }
    await X.post("actions/completeTurn", ctx(gameId));
  }
  g = await activeTurn(gameId, Y, [X]);
  check(playerOf(g, X).money === -2 && g.nextPlayerToAct === X.id, "X starts their turn in debt (-2) with the station unmortgaged");
  r = await X.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 });
  check(r.status === 400 && /negative/.test(r.data), "X cannot roll while in debt: " + r.data);
  // now X idles: the timer must mortgage the station and roll
  const res = await idleTimeout(gameId, Y);
  g = res.game;
  const x = playerOf(g, X);
  check(square(g, 6).isMortgaged, "timer mortgaged the station for X");
  check(x.money >= 578 - 300, `X is solvent again (${x.money}) after the +580 mortgage`);
  check(x.numTimeouts === 1, "the forced move counted as a timeout -> " + x.numTimeouts);
  check(/TIMEOUT: #1/.test(g.log[g.log.length - 1].msg) || g.log.some((l) => /TIMEOUT: #1/.test(l.msg)), "timeout noted in the game log");
}

section("three timeouts eliminate the idle player");
{
  let x = playerOf(await getGame(Y, gameId), X);
  let guard = 0;
  while (guard++ < 12) {
    g = await getGame(Y, gameId);
    if (g.status !== "Active") break;
    if (g.nextPlayerToAct === Y.id) {
      g = await activeTurn(gameId, Y, [X]);
      continue;
    }
    const before = playerOf(g, X).numTimeouts;
    // a timer period that only completes an already-rolled turn is not a new timeout
    const expected = playerOf(g, X).hasRolled ? before : before + 1;
    ({ game: g } = await idleTimeout(gameId, Y));
    x = playerOf(g, X);
    if (x.state === "Bankrupt") break;
    check(x.numTimeouts === expected, `timeout count  ->  (expected )`);
  }
  g = await getGame(Y, gameId);
  x = playerOf(g, X);
  check(x.state === "Bankrupt", "X eliminated after repeated timeouts (count reached " + x.numTimeouts + ")");
  check(g.status === "Finished" && g.winner === Y.username, "Y wins the game");
  check(g.squareState.every((s) => s.owner !== X.id), "X's mortgaged station released");
  check(x.finishedRank === 2 && playerOf(g, Y).finishedRank === 1, "ranks assigned");
  const stats = (await Y.post("findPlayers")).data.players;
  check(stats.find((p) => p.playerId === Y.id).wins === 1, "win recorded for Y");
  r = await X.post("current-session");
  check(r.data.currGameId === null, "finished game cleared for X");
}

// Not covered here: a player whose money is negative with no assets at all.
// That state is only reachable through a bad chance card, which cannot be
// forced; handleNegativeMoney and AutoMoveProcessor eliminate such a player
// when they next try to act or time out.

console.log(`\n${checks} checks, ${failures} failed`);
console.log(failures === 0 ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED");
process.exit(failures ? 1 : 0);
