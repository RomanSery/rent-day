// Players who start their turn in debt. Uses the development-only
// /api/dev/setPlayer route (set money, give squares) and forced dice/cards.
// Start the Worker with short timers and a fast bot pace:
//
//   npx wrangler dev --var DEV_TURN_SECONDS:6 --var DEV_AUCTION_SECONDS:6 --var DEV_BOT_PACE_MS:30
//   npm run test:api:debt   (or BASE=http://... node test/debt.mjs)
//
// "Beyond recovery" means owing more than selling every house and mortgaging
// every square would raise (totalAssets < 0). Such a player is eliminated as
// soon as the turn reaches them; anyone else must (or, for bots and timed-out
// players, will) sell and mortgage, then play on.

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
  const r = await c.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email: `${u}@t.com`, username: u, password: "pw-test-1", confirmPassword: "pw-test-1" });
  if (r.status !== 200) throw new Error("createAccount failed: " + JSON.stringify(r.data));
  c.id = r.data.id;
  c.username = u;
  return c;
};

const ctx = (gameId) => ({ context: { gameId } });
const getGame = async (c, gameId) => (await c.post("getGame", { gameId })).data.game;
const playerById = (game, id) => game.players.find((p) => p._id === id);
const playerOf = (game, c) => playerById(game, c.id);
const square = (game, id) => game.squareState.find((s) => s.squareId === id);
const setPlayer = async (c, gameId, playerId, body) => {
  const r = await c.post("dev/setPlayer", { gameId, playerId, ...body });
  if (r.status !== 200) throw new Error("dev/setPlayer failed (is the Worker in development mode?): " + JSON.stringify(r.data));
  return r.data.player;
};

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

/** Two humans; returns them as `cur` (whose turn it is) and `other`. */
const twoPlayerGame = async (name, useTimers) => {
  const a = await newUser("a"), b = await newUser("b");
  const r = await a.post("createGame", { data: { gameName: "Debt " + name, maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, useTimers }, context: {} });
  const gameId = r.data.gameId;
  await a.post("joinGame", { gameId, piece: "Car", playerClass: "Gambler" });
  await b.post("joinGame", { gameId, piece: "Dog", playerClass: "Gambler" });
  const game = await getGame(a, gameId);
  const cur = game.nextPlayerToAct === a.id ? a : b;
  return { gameId, cur, other: cur === a ? b : a, game };
};

/**
 * `cur` takes a quick turn that avoids squares other players own: a
 * non-double roll, everyone bids 0 in any auction, then end the turn.
 */
const harmlessTurn = async (gameId, cur, bidders) => {
  let g = await getGame(cur, gameId);
  const owned = new Set(g.squareState.filter((s) => s.owner && s.owner !== cur.id).map((s) => s.squareId));
  const [d1, d2] = splitDice(safeSum(playerOf(g, cur).position, owned));
  let r = await cur.post("actions/roll", { ...ctx(gameId), forceDie1: d1, forceDie2: d2 });
  if (r.status !== 200) throw new Error("harmless roll failed: " + JSON.stringify(r.data));
  g = await getGame(cur, gameId);
  if (g.auctionId) {
    for (const c of bidders) await c.post("actions/bid", { ...ctx(gameId), bid: 0 });
    const start = Date.now();
    while (g.auctionId && Date.now() - start < 15000) { await sleep(100); g = await getGame(cur, gameId); }
  }
  r = await cur.post("actions/completeTurn", ctx(gameId));
  return { response: r, game: await getGame(cur, gameId) };
};

/**
 * Give `player` square 2 and set their money so that, once this turn's
 * taxes are charged, they owe exactly what mortgaging it raises, plus `extra`.
 */
const owesMortgageValuePlus = async (c, gameId, playerId, extra) => {
  let p = await setPlayer(c, gameId, playerId, { squareIds: [2], purchasePrice: 200 });
  const perTurn = p.taxesPerTurn + p.electricityCostsPerTurn;
  p = await setPlayer(c, gameId, playerId, { money: -p.mortgageableValue - extra + perTurn });
  return { mortgageValue: p.mortgageableValue, perTurn };
};

// =========================================================================
section("a Chance card leaves a player with nothing: eliminated when the turn reaches them");
{
  const { gameId, cur: P, other: Q } = await twoPlayerGame("birthday", false);
  await setPlayer(P, gameId, Q.id, { money: 10 });
  // P: 1 -> 8 (Word on the Street) with "Lockdown birthday" forced: Q pays $30
  let r = await P.post("actions/roll", { ...ctx(gameId), forceDie1: 3, forceDie2: 4, forceChanceId: 21 });
  check(r.status === 200, "P lands on Word on the Street -> " + r.status);
  let g = await getGame(P, gameId);
  check(playerOf(g, Q).money === -20 && playerOf(g, Q).totalAssets === -20, "Q gave $30 and is at -$20 with no assets -> " + playerOf(g, Q).money);
  check(playerOf(g, Q).state === "Active", "Q is still in the game during P's turn");

  r = await P.post("actions/completeTurn", ctx(gameId));
  check(r.status === 200, "P ends the turn -> " + r.status + " " + JSON.stringify(r.data));
  g = await getGame(P, gameId);
  check(playerOf(g, Q).state === "Bankrupt", "Q is eliminated as their turn starts (was left unable to roll or end the turn)");
  check(g.status === "Finished" && g.winner === P.username, "P wins -> status " + g.status + ", winner " + g.winner);
  check(g.log.some((l) => /owing more than they can raise/.test(l.msg)), "the game log says why");
}

section("debt equal to what the player can raise: they keep playing");
{
  const { gameId, cur: P, other: Q } = await twoPlayerGame("exact", false);
  const { mortgageValue } = await owesMortgageValuePlus(P, gameId, Q.id, 0);
  let { response: r, game: g } = await harmlessTurn(gameId, P, [P, Q]);
  check(r.status === 200, "P ends the turn");
  let q = playerOf(g, Q);
  check(q.state === "Active" && g.nextPlayerToAct === Q.id, "Q is still in and it is Q's turn");
  check(q.money === -mortgageValue && q.totalAssets === 0, `Q owes ${-q.money}, exactly the ${mortgageValue} the square mortgages for (totalAssets ${q.totalAssets})`);
  r = await Q.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 });
  check(r.status === 400 && /negative/.test(r.data), "Q cannot roll while in debt: " + r.data);
  g = await getGame(Q, gameId);
  check(playerOf(g, Q).state === "Active", "trying to roll did not eliminate Q");
  r = await Q.post("actions/mortgage", { ...ctx(gameId), squareId: 2 });
  g = await getGame(Q, gameId);
  check(r.status === 200 && playerOf(g, Q).money === 0, "Q mortgages the square and is at $0 -> " + playerOf(g, Q).money);
  r = await Q.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 });
  check(r.status === 200, "Q can roll now -> " + r.status + " " + JSON.stringify(r.data));
}

section("debt $1 more than the player can raise: eliminated when the turn reaches them");
{
  const { gameId, cur: P, other: Q } = await twoPlayerGame("over", false);
  await owesMortgageValuePlus(P, gameId, Q.id, 1);
  const { response: r, game: g } = await harmlessTurn(gameId, P, [P, Q]);
  check(r.status === 200, "P ends the turn");
  check(playerOf(g, Q).state === "Bankrupt", "Q is eliminated (totalAssets " + playerOf(g, Q).totalAssets + ")");
  check(g.status === "Finished" && g.winner === P.username, "P wins");
  check(square(g, 2).owner == null, "Q's square is released");
}

section("timer: an idle player whose debt equals what they can raise is mortgaged and plays on");
{
  const { gameId, cur: P, other: Q, game } = await twoPlayerGame("timer", true);
  const secondsLeft = (new Date(game.nextPlayerActBy).getTime() - Date.now()) / 1000;
  if (secondsLeft >= 30) {
    console.log("  skip  turn timers are not short; start the Worker with --var DEV_TURN_SECONDS:6 --var DEV_AUCTION_SECONDS:6");
  } else {
    await owesMortgageValuePlus(P, gameId, Q.id, 0);
    let { game: g } = await harmlessTurn(gameId, P, [P, Q]);
    check(playerOf(g, Q).state === "Active" && g.nextPlayerToAct === Q.id, "Q's turn, in debt");
    await waitForDeadline(g.nextPlayerActBy);
    await P.post("actions/timesUpAction", ctx(gameId));
    g = await getGame(P, gameId);
    const q = playerOf(g, Q);
    check(square(g, 2).isMortgaged, "the timer mortgaged Q's square");
    check(q.state === "Active", "Q was not eliminated at $0 (used to be: totalAssets <= 0 counted as broke) -> " + q.state);
    check(q.numTimeouts === 1, "the forced move counted as a timeout -> " + q.numTimeouts);
  }
}

// =========================================================================
/** Wait until it is the human's turn with nothing rolled (bidding 0 in bot auctions), or the game ends. */
const waitForHuman = async (H, gameId, timeoutMs = 20000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const g = await getGame(H, gameId);
    if (g.status !== "Active") return g;
    if (g.nextPlayerToAct === H.id && !playerOf(g, H).hasRolled && !g.auctionId && !g.lottoId) return g;
    if (g.auctionId) {
      const auction = (await H.post("getAuction", { ...ctx(gameId), auctionId: g.auctionId })).data.auction;
      const mine = auction?.bidders.find((b) => b._id === H.id);
      if (mine && !mine.submittedBid) await H.post("actions/bid", { ...ctx(gameId), bid: 0 });
    }
    if (g.lottoId && g.nextPlayerToAct === H.id) await H.post("actions/pickLotto", { ...ctx(gameId), opt: 1 });
    await sleep(150);
  }
  throw new Error("the bot did not hand the turn back in time");
};

section("a bot that starts its turn in debt mortgages and plays on; beyond recovery it is eliminated");
{
  const H = await newUser("h");
  let r = await H.post("createGame", { data: { gameName: "Debt bot", maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, numBots: 1, botLevel: "Normal", useTimers: false }, context: {} });
  check(r.status === 200, "create a game against one computer player");
  const gameId = r.data.gameId;
  await H.post("joinGame", { gameId, piece: "Car", playerClass: "Gambler" });
  let g = await waitForHuman(H, gameId);
  const bot = g.players.find((p) => p.isBot);
  // a square nobody owns yet, to give the bot
  const free = [2, 4, 7, 9, 10, 12, 14, 15].find((id) => !square(g, id).owner);
  let b = await setPlayer(H, gameId, bot._id, { squareIds: [free], purchasePrice: 200 });
  const perTurn = b.taxesPerTurn + b.electricityCostsPerTurn;
  b = await setPlayer(H, gameId, bot._id, { money: -40 + perTurn });
  check(b.totalAssets > 0, `bot set to start its turn at -$40 owning square ${free} (totalAssets ${b.totalAssets - perTurn})`);
  const turnBefore = g.turnNumber;
  const mortgagedBy = (game) => game.squareState.filter((s) => s.owner === bot._id && s.isMortgaged).length;
  const mortgagedBefore = mortgagedBy(await getGame(H, gameId));
  ({ game: g } = await harmlessTurn(gameId, H, [H]));
  check(g.nextPlayerToAct === bot._id || g.turnNumber > turnBefore + 1, "the turn passed to the bot");
  check(playerById(g, bot._id).state === "Active", "the bot was not eliminated at the start of its turn");
  g = await waitForHuman(H, gameId);
  b = playerById(g, bot._id);
  check(b.state === "Active", "the bot played its turn and is still in -> " + b.state);
  check(mortgagedBy(g) > mortgagedBefore, `the bot mortgaged a square to cover the debt (${mortgagedBefore} -> ${mortgagedBy(g)} mortgaged)`);
  check(b.money >= 0, "the bot ended its turn solvent -> " + b.money);

  await setPlayer(H, gameId, bot._id, { money: -100000 });
  ({ game: g } = await harmlessTurn(gameId, H, [H]));
  check(playerById(g, bot._id).state === "Bankrupt", "a bot owing $100,000 is eliminated as its turn starts");
  check(g.status === "Finished" && g.winner === H.username, "the human wins -> " + g.status + " " + g.winner);
}

// =========================================================================
section("a Chance card mid-turn leaves the player owing more than they can raise: eliminated at once");
{
  const { gameId, cur: P, other: Q } = await twoPlayerGame("dentist", false);
  await setPlayer(Q, gameId, P.id, { money: 100 });
  // 1 -> 8 (Word on the Street) with "Unapproved gathering" (-$150) forced
  const r = await P.post("actions/roll", { ...ctx(gameId), forceDie1: 3, forceDie2: 4, forceChanceId: 1 });
  check(r.status === 200, "P lands on Word on the Street -> " + r.status);
  const g = await getGame(Q, gameId);
  check(playerOf(g, P).state === "Bankrupt", "P (-$50, nothing to sell) is eliminated right away instead of being left unable to end the turn -> " + playerOf(g, P).state + " " + playerOf(g, P).money);
  check(g.status === "Finished" && g.winner === Q.username, "Q wins -> " + g.status + " " + g.winner);
}

section("a Chance card mid-turn that the player can cover: they stay in and must mortgage");
{
  const { gameId, cur: P, other: Q } = await twoPlayerGame("dentist2", false);
  await setPlayer(Q, gameId, P.id, { money: 100, squareIds: [2], purchasePrice: 200 });
  await P.post("actions/roll", { ...ctx(gameId), forceDie1: 3, forceDie2: 4, forceChanceId: 1 });
  const g = await getGame(Q, gameId);
  check(playerOf(g, P).state === "Active" && playerOf(g, P).money === -50, "P is at -$50 but can mortgage a square for $80 -> still in");
  let r = await P.post("actions/completeTurn", ctx(gameId));
  check(r.status === 400, "P can't end the turn in debt -> " + JSON.stringify(r.data));
  await P.post("actions/mortgage", { ...ctx(gameId), squareId: 2 });
  r = await P.post("actions/completeTurn", ctx(gameId));
  check(r.status === 200, "after mortgaging, P ends the turn");
}

section("rent equal to everything the player has: pays down to $0 and stays in");
{
  // probe: what P pays to land on Q's square 4 from the start
  const probe = await twoPlayerGame("rentprobe", false);
  await setPlayer(probe.cur, probe.gameId, probe.other.id, { squareIds: [4], purchasePrice: 200 });
  await probe.cur.post("actions/roll", { ...ctx(probe.gameId), forceDie1: 1, forceDie2: 2 });
  const rent = (await getGame(probe.cur, probe.gameId)).lastRent?.amount;
  check(rent > 0, "landing on square 4 costs $" + rent + " in rent");

  const { gameId, cur: P, other: Q } = await twoPlayerGame("rentexact", false);
  await setPlayer(P, gameId, Q.id, { squareIds: [4], purchasePrice: 200 });
  await setPlayer(P, gameId, P.id, { money: rent });
  await P.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 });
  let g = await getGame(P, gameId);
  check(g.lastRent?.amount === rent && playerOf(g, P).money === 0, "P paid all $" + rent + " and has $0 -> " + playerOf(g, P).money);
  check(playerOf(g, P).state === "Active", "P is still in (used to be eliminated when rent >= everything they had)");
  const r = await P.post("actions/completeTurn", ctx(gameId));
  check(r.status === 200, "P ends the turn at $0");

  const over = await twoPlayerGame("rentover", false);
  await setPlayer(over.cur, over.gameId, over.other.id, { squareIds: [4], purchasePrice: 200 });
  await setPlayer(over.cur, over.gameId, over.cur.id, { money: rent - 1 });
  await over.cur.post("actions/roll", { ...ctx(over.gameId), forceDie1: 1, forceDie2: 2 });
  g = await getGame(over.cur, over.gameId);
  check(playerOf(g, over.cur).state === "Bankrupt", "with $1 less than the rent, P is eliminated");
}

// =========================================================================
/** Three humans, no timers; `seats` in turn order starting with whoever acts first. */
const threePlayerGame = async (name) => {
  const a = await newUser("a"), b = await newUser("b"), c = await newUser("c");
  const r = await a.post("createGame", { data: { gameName: "Debt " + name, maxPlayers: 3, initialMoney: 1500, initialSkillPoints: 5, useTimers: false }, context: {} });
  const gameId = r.data.gameId;
  await a.post("joinGame", { gameId, piece: "Car", playerClass: "Gambler" });
  await b.post("joinGame", { gameId, piece: "Dog", playerClass: "Gambler" });
  await c.post("joinGame", { gameId, piece: "Hat", playerClass: "Gambler" });
  const game = await getGame(a, gameId);
  const byId = new Map([a, b, c].map((x) => [x.id, x]));
  const start = game.players.findIndex((p) => p._id === game.nextPlayerToAct);
  const seats = [0, 1, 2].map((i) => byId.get(game.players[(start + i) % 3]._id));
  return { gameId, seats };
};

section("resigning mid-auction after placing the top bid: the bid no longer counts");
{
  const { gameId, seats: [P, Q, R] } = await threePlayerGame("auctionbid");
  let r = await P.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 }); // 1 -> 4, unowned
  let g = await getGame(P, gameId);
  check(r.status === 200 && g.auctionId && g.auctionSquareId === 4, "square 4 goes up for auction");
  await P.post("actions/bid", { ...ctx(gameId), bid: 500 });
  await P.post("resignGame", { gameId });
  g = await getGame(Q, gameId);
  check(playerOf(g, P).state === "Bankrupt" && g.status === "Active", "P gives up; the game goes on");
  check(!!g.auctionId, "the auction stays open for Q and R");
  await Q.post("actions/bid", { ...ctx(gameId), bid: 100 });
  await R.post("actions/bid", { ...ctx(gameId), bid: 60 });
  g = await getGame(Q, gameId);
  check(!g.auctionId, "the auction closes once Q and R have bid");
  check(square(g, 4).owner === Q.id, "Q wins square 4, not the eliminated P (owner " + square(g, 4).owner + ")");
  check(g.lastAuction?.price === 60, "Q pays the second-highest live bid, $60, not P's $500 -> " + g.lastAuction?.price);
  check(g.nextPlayerToAct === Q.id, "the turn moved on to Q");
}

section("resigning mid-auction before bidding: the auction closes instead of waiting forever");
{
  const { gameId, seats: [P, Q, R] } = await threePlayerGame("auctionwait");
  await P.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 });
  await Q.post("actions/bid", { ...ctx(gameId), bid: 100 });
  await R.post("actions/bid", { ...ctx(gameId), bid: 0 });
  let g = await getGame(Q, gameId);
  check(!!g.auctionId, "the auction waits on P's bid");
  await P.post("resignGame", { gameId });
  g = await getGame(Q, gameId);
  check(!g.auctionId, "with P out, the auction closes (no timers to close it otherwise)");
  check(square(g, 4).owner === Q.id, "Q wins square 4");
  const r = await Q.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 });
  check(r.status === 200, "Q can take their turn -> " + JSON.stringify(r.data));
}

section("the last opponent resigns mid-auction: the game ends and nobody buys the square");
{
  const { gameId, cur: P, other: Q } = await twoPlayerGame("auctionend", false);
  await P.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 });
  await Q.post("actions/bid", { ...ctx(gameId), bid: 100 });
  await Q.post("resignGame", { gameId });
  const g = await getGame(P, gameId);
  check(g.status === "Finished" && g.winner === P.username, "P wins");
  check(!g.auctionId && !square(g, 4).owner, "auction cleared, square 4 unsold");
}

console.log(`\n${checks} checks, ${failures} failed`);
console.log(failures === 0 ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED");
process.exit(failures ? 1 : 0);
