// Deep scenario tests against the local Worker in development mode
// (forced dice honoured, DEV_PREOWN_PROPERTIES off).
//
//   npm run test:api:deep   (or BASE=http://... node test/deep.mjs)
// Needs ENVIRONMENT=development so forced dice are honoured, and
// DEV_PREOWN_PROPERTIES unset/false. Takes about four minutes (one
// scenario waits for a real 80 second turn timer).

const BASE = process.env.BASE || "http://localhost:8787";
const WS_BASE = BASE.replace(/^http/, "ws");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
let checks = 0;
const check = (cond, msg) => {
  checks++;
  console.log((cond ? "  ok   " : "  FAIL ") + msg);
  if (!cond) failures++;
};
const section = (t) => console.log("\n== " + t);

// --- board facts ---------------------------------------------------------
const CHANCE = new Set([3, 8, 23, 33]);
const LOTTO = new Set([13, 28, 39]);
const GO_TO_ISOLATION = 31;
const ISOLATION = 11;
const PAYDAY = 1;
const STATIONS = [6, 16, 26, 36];

// --- http / ws client ----------------------------------------------------
class Client {
  constructor(name) {
    this.name = name;
    this.cookie = "";
    this.id = null;
    this.events = [];
    this.ws = null;
  }
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
      ws.addEventListener("message", (ev) => { try { this.events.push(JSON.parse(ev.data)); } catch {} });
      this.ws = ws;
    });
  }
  send(event, ...args) { this.ws?.send(JSON.stringify({ event, args })); }
  received(event) { return this.events.filter((e) => e.event === event); }
  clear() { this.events = []; }
  close() { try { this.ws?.close(); } catch {} }
}

const suffix = Date.now().toString(36).slice(-5);
let userCounter = 0;
const newUser = async (label) => {
  const c = new Client(label);
  const u = `${label}${suffix}${userCounter++}`.slice(0, 10);
  const r = await c.post("createAccount", { email: `${u}@t.com`, username: u, password: "pw-test-1", confirmPassword: "pw-test-1" });
  if (r.status !== 200) throw new Error("createAccount failed: " + JSON.stringify(r.data));
  c.id = r.data.id;
  c.username = u;
  return c;
};

// --- game helpers ----------------------------------------------------------
const ctx = (gameId) => ({ context: { gameId } });

const getGame = async (c, gameId) => (await c.post("getGame", { gameId })).data.game;
const playerOf = (game, c) => game.players.find((p) => p._id === c.id);
const square = (game, id) => game.squareState.find((s) => s.squareId === id);
const byId = (players, id) => players.find((p) => p.id === id);

const splitDice = (sum) => {
  if (sum < 2 || sum > 12) throw new Error("bad sum " + sum);
  if (sum === 2) return [1, 1];
  if (sum === 12) return [6, 6];
  // non-double split
  for (let d1 = 1; d1 <= 6; d1++) {
    const d2 = sum - d1;
    if (d2 >= 1 && d2 <= 6 && d1 !== d2) return [d1, d2];
  }
  throw new Error("no split for " + sum);
};

const dist = (from, to) => ((to - from) % 40 + 40) % 40;

/**
 * Roll forced dice for `cur`, then resolve whatever the landing produced:
 * auction (bids per player via `bidFor(client) -> amount`), lotto (pick).
 * Returns the refreshed game and the roll response.
 */
const forcedRoll = async (players, gameId, cur, d1, d2, bidFor) => {
  const r = await cur.post("actions/roll", { ...ctx(gameId), forceDie1: d1, forceDie2: d2 });
  if (r.status !== 200) {
    return { game: await getGame(cur, gameId), roll: r };
  }
  cur.send("updateGameState", gameId);
  let game = await getGame(cur, gameId);

  if (game.auctionId) {
    for (const p of players) {
      const me = playerOf(game, p);
      if (!me || me.state === "Bankrupt") continue;
      const amount = bidFor ? bidFor(p) : 0;
      const b = await p.post("actions/bid", { ...ctx(gameId), bid: amount });
      if (b.status !== 200) console.log("    bid rejected for " + p.name + ": " + b.data);
    }
    game = await getGame(cur, gameId);
  }
  if (game.lottoId) {
    const l = await cur.post("actions/pickLotto", { ...ctx(gameId), opt: 1 });
    if (l.status !== 200) console.log("    lotto pick rejected: " + l.data);
    game = await getGame(cur, gameId);
  }
  return { game, roll: r };
};

const endTurn = async (gameId, cur) => {
  const r = await cur.post("actions/completeTurn", ctx(gameId));
  if (r.status !== 200) console.log("    completeTurn rejected for " + cur.name + ": " + r.data);
  cur.send("updateGameState", gameId, true);
  return r;
};

/** Squares owned by anyone other than `me` (landing there would cost rent). */
const ownedByOthers = (game, me) =>
  new Set(game.squareState.filter((s) => s.owner && s.owner !== me.id).map((s) => s.squareId));

/** Pick a non-double move of 3..11 squares that avoids the risky squares. */
const safeSum = (pos, avoid = new Set()) => {
  for (const sum of [3, 5, 7, 9, 11]) {
    const land = ((pos - 1 + sum) % 40) + 1;
    if (land === GO_TO_ISOLATION || CHANCE.has(land) || LOTTO.has(land) || avoid.has(land)) continue;
    return sum;
  }
  return 3;
};

/**
 * Make the current player (whoever it is) take a harmless turn: a small
 * non-double move, bid 0 in any auction, end the turn.
 */
const harmlessTurn = async (players, gameId, game) => {
  const cur = byId(players, game.nextPlayerToAct);
  const me = playerOf(game, cur);
  if (me.state === "In_Isolation") {
    // sit it out with a non-double roll
    const res = await forcedRoll(players, gameId, cur, 1, 2);
    await endTurn(gameId, cur);
    return getGame(cur, gameId);
  }
  let g = game;
  if (!me.hasRolled) {
    const sum = safeSum(me.position, ownedByOthers(game, cur));
    const [d1, d2] = splitDice(sum);
    ({ game: g } = await forcedRoll(players, gameId, cur, d1, d2));
  }
  await endTurn(gameId, cur);
  return getGame(cur, gameId);
};

/** Advance play until it is `target`'s turn (with nothing rolled yet). */
const untilTurnOf = async (players, gameId, target) => {
  let game = await getGame(target, gameId);
  for (let guard = 0; guard < 20; guard++) {
    const me = playerOf(game, target);
    if (game.nextPlayerToAct === target.id && !me.hasRolled) return game;
    game = await harmlessTurn(players, gameId, game);
  }
  throw new Error("never got to " + target.name + "'s turn");
};

/**
 * Walk `target` to `squareId` over as many turns as needed. On the final
 * landing, `bidFor` decides the auction. Returns the game after landing
 * (turn NOT ended).
 */
const walkTo = async (players, gameId, target, squareId, bidFor) => {
  let game = await untilTurnOf(players, gameId, target);
  for (let guard = 0; guard < 12; guard++) {
    const me = playerOf(game, target);
    const d = dist(me.position, squareId);
    if (d >= 3 && d <= 11) {
      // 2 and 12 would force a double and leave the turn open
      const [d1, d2] = splitDice(d);
      const res = await forcedRoll(players, gameId, target, d1, d2, bidFor);
      return res.game;
    }
    // intermediate hop
    const sum = safeSum(me.position, new Set([squareId, ...ownedByOthers(game, target)]));
    const [d1, d2] = splitDice(sum);
    ({ game } = await forcedRoll(players, gameId, target, d1, d2));
    await endTurn(gameId, target);
    game = await untilTurnOf(players, gameId, target);
  }
  throw new Error("could not walk to " + squareId);
};

// =========================================================================
section("accounts and validation");
const A = await newUser("ba"); // Banker
const O = await newUser("ga"); // Gambler (property owner in the scenario)
const C = await newUser("co"); // Conductor

let r = await A.post("createAccount", { email: `x${suffix}@t.com`, username: A.username, password: "pw-test-1", confirmPassword: "pw-test-1" });
check(r.status === 403, "duplicate username rejected -> " + r.status);
r = await A.post("createAccount", { email: `y${suffix}@t.com`, username: "ab!", password: "pw-test-1", confirmPassword: "pw-test-1" });
check(r.status === 400, "non-alphanumeric username rejected -> " + r.status);
r = await A.post("createAccount", { email: `z${suffix}@t.com`, username: "abcdefghijk", password: "pw-test-1", confirmPassword: "pw-test-1" });
check(r.status === 400, "11-char username rejected -> " + r.status);
r = await A.post("createAccount", { email: `w${suffix}@t.com`, username: `w${suffix}`, password: "pw-test-1", confirmPassword: "pw-test-2" });
check(r.status === 400 && r.data.errors?.[0]?.param === "confirmPassword", "password mismatch flagged on confirmPassword");

section("lobby rules");
r = await A.post("createGame", { data: { gameName: "Too many", maxPlayers: 7, initialMoney: 1500, initialSkillPoints: 5 }, context: {} });
check(r.status === 400, "7 players rejected -> " + r.status);
r = await A.post("createGame", { data: { gameName: "Locked", maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, gamePwd: "sesame" }, context: {} });
const lockedId = r.data.gameId;
check(r.status === 200, "password game created");
let g = await getGame(O, lockedId);
check(g.settings.password === "protected", "password hash not exposed, placeholder returned");
r = await O.post("joinGame", { gameId: lockedId, piece: "Dog", playerClass: "Gambler" });
check(r.status === 400 && /Password/.test(r.data), "join without password rejected: " + r.data);
r = await O.post("joinGame", { gameId: lockedId, piece: "Dog", playerClass: "Gambler", gamePwd: "wrong" });
check(r.status === 400, "join with wrong password rejected");
r = await O.post("joinGame", { gameId: lockedId, piece: "Dog", playerClass: "Gambler", gamePwd: "sesame" });
check(r.status === 200, "join with right password accepted");
r = await A.post("joinGame", { gameId: lockedId, piece: "Dog", playerClass: "Banker", gamePwd: "sesame" });
check(r.status === 400 && /piece/.test(r.data), "duplicate piece rejected: " + r.data);
r = await A.post("joinGame", { gameId: lockedId, piece: "Unicorn", playerClass: "Banker", gamePwd: "sesame" });
check(r.status === 400, "unknown piece rejected");
r = await O.post("leaveGame", { gameId: lockedId });
check(r.status === 200, "leave during lobby");
g = await getGame(O, lockedId);
check(g.players.length === 0 && g.status === "Joining", "lobby empty again and still joining");
r = await O.post("current-session");
check(r.data.currGameId === null, "left lobby cleared current game");
r = await A.post("findGames");
check(r.data.games.some((x) => x.gameId === lockedId && x.playersJoined === 0), "lobby index updated to 0 players");

section("three-player game setup");
r = await O.post("createGame", { data: { gameName: "Deep", maxPlayers: 3, initialMoney: 1500, initialSkillPoints: 5, useTimers: false }, context: {} });
const gameId = r.data.gameId;
const players = [A, O, C];
for (const p of players) await p.connect(gameId);
await A.post("joinGame", { gameId, piece: "Car", playerClass: "Banker" });
await O.post("joinGame", { gameId, piece: "Cat", playerClass: "Gambler" });
r = await A.post("joinGame", { gameId, piece: "Dog", playerClass: "Banker" });
check(r.status === 400, "joining twice rejected");
r = await C.post("joinGame", { gameId, piece: "Hat", playerClass: "Conductor" });
check(r.status === 200 && r.data.allJoined, "third player fills the game");
r = await A.post("joinGame", { gameId: lockedId, piece: "Dog", playerClass: "Banker", gamePwd: "sesame" });
check(r.status === 400 && /another game/.test(r.data), "cannot join a second game while playing one: " + r.data);

g = await getGame(A, gameId);
check(g.status === "Active" && g.players.every((p) => p.money === 1500 && p.position === 1), "all start at square 1 with $1500");
check(g.players.every((p) => p.numAbilityPoints === 5), "initial skill points applied");
check(playerOf(g, C).negotiation === 2, "Conductor starts with 2 negotiation");
check(g.squareState.every((s) => !s.owner), "no property pre-owned");

section("turn enforcement");
{
  const notCur = players.find((p) => p.id !== g.nextPlayerToAct);
  r = await notCur.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 });
  check(r.status === 400 && /turn/.test(r.data), "rolling out of turn rejected: " + r.data);
  r = await notCur.post("actions/completeTurn", ctx(gameId));
  check(r.status === 400, "completing turn out of turn rejected");
  const cur = byId(players, g.nextPlayerToAct);
  r = await cur.post("actions/completeTurn", ctx(gameId));
  check(r.status === 400 && /roll/.test(r.data), "completing turn before rolling rejected: " + r.data);
}

section("owner acquires square 4 at the auction's second price");
g = await walkTo(players, gameId, O, 4, (p) => (p === O ? 50 : 20));
{
  const s4 = square(g, 4);
  check(s4.owner === O.id && s4.purchasePrice === 20, `square 4 owned by O for $${s4.purchasePrice} (second price)`);
  check(s4.mortgageValue === 8, "mortgage value is 40% of price -> " + s4.mortgageValue);
  check(playerOf(g, O).money === 1480, "O paid 20 -> " + playerOf(g, O).money);
  const auctionLog = g.log.some((l) => /won the auction/.test(l.msg));
  check(auctionLog, "auction result in game log");
  await endTurn(gameId, O);
}

section("owner walks around the board to square 2 (payday on the way)");
{
  const before = (await getGame(O, gameId));
  const moneyBefore = playerOf(before, O).money;
  const pointsBefore = playerOf(before, O).numAbilityPoints;
  g = await walkTo(players, gameId, O, 2, (p) => (p === O ? 60 : 20));
  const me = playerOf(g, O);
  const s2 = square(g, 2);
  check(s2.owner === O.id, "square 2 owned by O");
  check(me.money === moneyBefore + 200 - 20, `payday +200 then paid 20 -> ${me.money} (from ${moneyBefore})`);
  check(me.numAbilityPoints === pointsBefore + 1, "payday grants a skill point");
  check(/Payday/.test(g.results.description), "payday noted in results");
  await endTurn(gameId, O);
}

section("houses and mortgages");
{
  g = await getGame(O, gameId);
  let money = playerOf(g, O).money;
  r = await O.post("actions/buildHouse", { ...ctx(gameId), squareId: 7 });
  check(r.status === 400, "building on a square you don't own rejected");
  r = await A.post("actions/buildHouse", { ...ctx(gameId), squareId: 2 });
  check(r.status === 400 && /owner/.test(r.data), "non-owner cannot build: " + r.data);
  r = await O.post("actions/buildHouse", { ...ctx(gameId), squareId: 2 });
  check(r.status === 200, "owner of the full group builds on 2");
  g = await getGame(O, gameId);
  check(square(g, 2).numHouses === 1 && playerOf(g, O).money === money - 50, "house cost 50 deducted -> " + playerOf(g, O).money);
  money -= 50;
  r = await O.post("actions/buildHouse", { ...ctx(gameId), squareId: 2 });
  check(r.status === 400 && /evenly/.test(r.data), "second house on 2 must wait for 4: " + r.data);
  r = await O.post("actions/mortgage", { ...ctx(gameId), squareId: 4 });
  check(r.status === 400 && /houses/.test(r.data), "mortgage blocked while group has houses: " + r.data);
  r = await O.post("actions/offerTrade", { ...ctx(gameId), tradingWithPlayerId: A.id, mines: [2], theirs: [], myAmount: 0, theirAmount: 10 });
  check(r.status === 400 && /houses/.test(r.data), "trading a house square blocked: " + r.data);
  r = await O.post("actions/offerTrade", { ...ctx(gameId), tradingWithPlayerId: A.id, mines: [4], theirs: [], myAmount: 0, theirAmount: 10 });
  check(r.status === 400 && /group with houses/.test(r.data), "trading a square whose group has houses blocked: " + r.data);
  r = await O.post("actions/buildHouse", { ...ctx(gameId), squareId: 4 });
  check(r.status === 200, "house on 4 evens the group");
  r = await O.post("actions/sellHouse", { ...ctx(gameId), squareId: 4 });
  check(r.status === 200, "sell house on 4");
  g = await getGame(O, gameId);
  check(playerOf(g, O).money === money - 50 + 25, "sale refunds half the house cost -> " + playerOf(g, O).money);
  money = money - 50 + 25;
  r = await O.post("actions/sellHouse", { ...ctx(gameId), squareId: 4 });
  check(r.status === 400, "selling with no houses rejected");
  r = await O.post("actions/sellHouse", { ...ctx(gameId), squareId: 2 });
  check(r.status === 200, "sell last house");
  money += 25;
  r = await O.post("actions/mortgage", { ...ctx(gameId), squareId: 4 });
  check(r.status === 200, "mortgage 4 once houses are gone");
  g = await getGame(O, gameId);
  check(square(g, 4).isMortgaged && playerOf(g, O).money === money + 8, "mortgage pays 8 -> " + playerOf(g, O).money);
  money += 8;
  check(playerOf(g, O).redeemableValue === 9 && playerOf(g, O).mortgageableValue === square(g, 2).mortgageValue, "redeemable/mortgageable values updated");
  r = await O.post("actions/mortgage", { ...ctx(gameId), squareId: 4 });
  check(r.status === 400, "double mortgage rejected");
  r = await O.post("actions/buildHouse", { ...ctx(gameId), squareId: 2 });
  check(r.status === 400 && /mortgaged/.test(r.data), "no building while a group member is mortgaged: " + r.data);
}

section("rent: mortgaged square collects nothing, full group doubles rent");
{
  const bank = A; // Banker: negotiation 0 so rent is exact
  g = await walkTo(players, gameId, bank, 4);
  check(playerOf(g, bank).position === 4, "A landed on 4");
  check(!/rent/.test(g.results.description), "no rent on a mortgaged square");
  await endTurn(gameId, bank);
  const beforeRedeem = playerOf(await getGame(O, gameId), O).money;
  r = await O.post("actions/redeem", { ...ctx(gameId), squareId: 4 });
  check(r.status === 200, "redeem 4");
  check(playerOf(await getGame(O, gameId), O).money === beforeRedeem - 9, "redeem costs 9 (mortgage value + 10%)");
  const afterMortgage = (await getGame(O, gameId));
  g = afterMortgage;
  check(!square(g, 4).isMortgaged, "4 redeemed");
  const aBefore = playerOf(g, A).money;
  const oBefore = playerOf(g, O).money;
  // A goes once around and lands on 2 (owned by O, group complete, no houses -> 10 * 2)
  g = await walkTo(players, gameId, A, 2);
  check(playerOf(g, A).position === 2, "A landed on 2");
  const paid = aBefore + 300 - playerOf(g, A).money; // Banker payday is 300
  check(paid === 20, `A paid doubled base rent 20 (paid ${paid})`);
  check(playerOf(g, O).money === oBefore + 20, "O received the rent");
  check(/Paid .* in rent/.test(g.results.description), "rent noted in results");
  await endTurn(gameId, A);
}

section("trade with property changes ownership and breaks the group");
{
  g = await getGame(O, gameId);
  const oBefore = playerOf(g, O).money;
  const aBefore = playerOf(g, A).money;
  r = await O.post("actions/offerTrade", { ...ctx(gameId), tradingWithPlayerId: A.id, mines: [2], theirs: [], myAmount: 0, theirAmount: 40 });
  check(r.status === 200, "offer square 2 for $40");
  const tradeId = r.data.newTradeId;
  r = await O.post("actions/acceptTrade", { ...ctx(gameId), tradeId });
  check(r.status === 400, "offerer cannot accept their own trade");
  r = await C.post("actions/acceptTrade", { ...ctx(gameId), tradeId });
  check(r.status === 400, "third party cannot accept the trade");
  r = await A.post("actions/acceptTrade", { ...ctx(gameId), tradeId });
  check(r.status === 200, "recipient accepts");
  g = await getGame(O, gameId);
  check(square(g, 2).owner === A.id && square(g, 2).color === playerOf(g, A).color, "square 2 now owned by A with A's colour");
  check(playerOf(g, O).money === oBefore + 40 && playerOf(g, A).money === aBefore - 40, "money moved with the trade");
  r = await O.post("actions/buildHouse", { ...ctx(gameId), squareId: 4 });
  check(r.status === 400 && /own all/.test(r.data), "group broken, no more building: " + r.data);
  r = await A.post("actions/offerTrade", { ...ctx(gameId), tradingWithPlayerId: O.id, mines: [2], theirs: [], myAmount: 0, theirAmount: 40 });
  const t2 = r.data.newTradeId;
  r = await O.post("actions/declineTrade", { ...ctx(gameId), tradeId: t2 });
  check(r.status === 200, "decline a trade");
  r = await O.post("actions/acceptTrade", { ...ctx(gameId), tradeId: t2 });
  check(r.status === 400 && /declined/.test(r.data), "declined trade cannot be accepted later: " + r.data);
  r = await A.post("actions/offerTrade", { ...ctx(gameId), tradingWithPlayerId: O.id, mines: [], theirs: [], myAmount: 5000, theirAmount: 1 });
  check(r.status === 400, "cannot offer more money than you have");
}

section("quarantine: land on 31, sit a turn, pay to get out");
{
  g = await walkTo(players, gameId, C, GO_TO_ISOLATION);
  let me = playerOf(g, C);
  check(me.state === "In_Isolation" && me.position === ISOLATION, `C sent to quarantine (pos ${me.position}, ${me.state})`);
  check(me.hasRolled, "turn is over after being sent to quarantine");
  await endTurn(gameId, C);
  r = await C.post("actions/getOut", ctx(gameId));
  check(r.status === 400 && /turn/.test(r.data), "paying out of quarantine off-turn rejected");
  g = await untilTurnOf(players, gameId, C);
  const moneyBefore = playerOf(g, C).money;
  ({ game: g } = await forcedRoll(players, gameId, C, 1, 2));
  me = playerOf(g, C);
  check(me.state === "In_Isolation" && me.position === ISOLATION && me.numTurnsInIsolation === 1, "non-double roll keeps C in quarantine");
  check(/Still in quarantine 1\/3/.test(g.results.description), "quarantine progress in results");
  await endTurn(gameId, C);
  g = await untilTurnOf(players, gameId, C);
  r = await C.post("actions/getOut", ctx(gameId));
  check(r.status === 200, "pay to get out");
  g = await getGame(C, gameId);
  me = playerOf(g, C);
  check(me.state === "Active" && me.money === moneyBefore - 100 && me.numTurnsInIsolation === 0, "C active again and $100 poorer");
  r = await C.post("actions/getOut", ctx(gameId));
  check(r.status === 400, "cannot pay again when not in quarantine");
  ({ game: g } = await forcedRoll(players, gameId, C, 1, 2));
  check(playerOf(g, C).position === ISOLATION + 3, "moves normally after paying out");
  await endTurn(gameId, C);
}

section("quarantine via a double on the way out");
{
  g = await walkTo(players, gameId, A, GO_TO_ISOLATION);
  check(playerOf(g, A).state === "In_Isolation", "A quarantined");
  await endTurn(gameId, A);
  g = await untilTurnOf(players, gameId, A);
  ({ game: g } = await forcedRoll(players, gameId, A, 2, 2));
  const me = playerOf(g, A);
  check(me.state === "Active" && me.position === ISOLATION + 4, "double releases A and moves them");
  check(me.hasRolled, "no extra roll after a releasing double");
  await endTurn(gameId, A);
}

section("three consecutive doubles send you to quarantine");
{
  g = await untilTurnOf(players, gameId, O);
  const start = playerOf(g, O).position;
  ({ game: g } = await forcedRoll(players, gameId, O, 1, 1));
  check(!playerOf(g, O).hasRolled, "first double: roll again");
  ({ game: g } = await forcedRoll(players, gameId, O, 1, 1));
  check(!playerOf(g, O).hasRolled, "second double: roll again");
  ({ game: g } = await forcedRoll(players, gameId, O, 1, 1));
  const me = playerOf(g, O);
  check(me.state === "In_Isolation" && me.position === ISOLATION && me.hasRolled, `third double -> quarantine (from ${start})`);
  await endTurn(gameId, O);
  g = await untilTurnOf(players, gameId, O);
  r = await O.post("actions/getOut", ctx(gameId));
  check(r.status === 200, "O pays out");
  ({ game: g } = await forcedRoll(players, gameId, O, 1, 2));
  await endTurn(gameId, O);
}

section("lotto");
{
  const target = [...LOTTO][0];
  g = await untilTurnOf(players, gameId, C);
  // walk manually so the lotto is not auto-picked by the helper
  let me = playerOf(g, C);
  while (dist(me.position, target) > 11 || dist(me.position, target) < 3) {
    const sum = safeSum(me.position, new Set([target, ...ownedByOthers(g, C)]));
    const [d1, d2] = splitDice(sum);
    ({ game: g } = await forcedRoll(players, gameId, C, d1, d2));
    await endTurn(gameId, C);
    g = await untilTurnOf(players, gameId, C);
    me = playerOf(g, C);
  }
  const [d1, d2] = splitDice(dist(me.position, target));
  r = await C.post("actions/roll", { ...ctx(gameId), forceDie1: d1, forceDie2: d2 });
  g = await getGame(C, gameId);
  check(g.lottoId != null, "lotto created on landing");
  r = await C.post("actions/completeTurn", ctx(gameId));
  check(r.status === 400 && /lotto/.test(r.data), "cannot end turn with an open lotto");
  r = await A.post("actions/pickLotto", { ...ctx(gameId), opt: 1 });
  check(r.status === 400, "another player cannot pick your lotto");
  r = await C.post("actions/pickLotto", { ...ctx(gameId), opt: 9 });
  check(r.status === 400, "invalid option rejected");
  const lottoId = g.lottoId;
  const moneyBefore = playerOf(g, C).money;
  r = await C.post("actions/pickLotto", { ...ctx(gameId), opt: 2 });
  check(r.status === 200, "pick option 2");
  const lotto = (await C.post("getLotto", { ...ctx(gameId), lottoId })).data.lotto;
  g = await getGame(C, gameId);
  check(lotto.optionPicked === 2 && lotto.randomNum >= 1 && lotto.randomNum <= 100, "lotto resolved with a draw");
  const won = lotto.randomNum <= lotto.option2Percent;
  check(lotto.prize === (won ? lotto.option2Amount : 0), `prize matches draw (${won ? "won" : "lost"})`);
  check(playerOf(g, C).money === moneyBefore + lotto.prize, "prize credited");
  check(g.lottoId === null, "lotto cleared");
  r = await C.post("actions/pickLotto", { ...ctx(gameId), opt: 1 });
  check(r.status === 400, "cannot pick twice");
  await endTurn(gameId, C);
}

section("chance card arrives after the delay");
{
  const target = 8;
  g = await walkTo(players, gameId, A, target);
  players.forEach((p) => p.clear());
  g = await untilTurnOf(players, gameId, A).catch(() => g);
  // walkTo already landed; the event is scheduled 5s after the roll
  await sleep(5500);
  const ev = O.received("showChanceEvent");
  check(ev.length >= 1 && typeof ev[0].args[0][0].chanceId === "number", "all players got the chance card: " + (ev[0]?.args[0]?.[0]?.headline ?? "none"));
}

section("chat limits");
{
  O.clear();
  A.send("sendChatMsg", gameId, { msg: "x".repeat(500), player: "spoofed" });
  await sleep(300);
  const m = O.received("newChatMsg")[0];
  check(m && m.args[0].msg.length === 200, "chat truncated to 200 chars");
  check(m && m.args[0].player === A.username, "sender name comes from the session, not the message");
}

section("reconnect announces itself");
{
  O.clear();
  C.close();
  await sleep(300);
  check(O.received("showSnackMsg").some((e) => /disconnected/.test(e.args[0])), "disconnect snack");
  await C.connect(gameId);
  C.send("joinGameRoom", gameId, C.id, C.username);
  await sleep(300);
  check(O.received("showSnackMsg").some((e) => /re-connected/.test(e.args[0])), "re-connect snack");
}

section("travel between owned train stations");
{
  // O buys stations 6 and 16, returns to 6 and takes the subway to 16
  g = await walkTo(players, gameId, O, 6, (p) => (p === O ? 30 : 10));
  check(square(g, 6).owner === O.id, "O owns station 6");
  r = await O.post("actions/travel", { ...ctx(gameId), squareId: 16 });
  check(r.status === 400, "cannot travel after rolling / to a station you don't own: " + r.data);
  await endTurn(gameId, O);
  g = await walkTo(players, gameId, O, 16, (p) => (p === O ? 30 : 10));
  check(square(g, 16).owner === O.id, "O owns station 16");
  await endTurn(gameId, O);
  g = await walkTo(players, gameId, O, 6);
  check(playerOf(g, O).position === 6 && /rent/.test(g.results.description) === false, "O back on their own station, no rent");
  await endTurn(gameId, O);
  g = await untilTurnOf(players, gameId, O);
  check(playerOf(g, O).canTravel === true, "canTravel flag set while standing on an owned station with 2+ stations");
  r = await O.post("actions/travel", { ...ctx(gameId), squareId: 26 });
  check(r.status === 400 && /owned/.test(r.data), "cannot travel to a station you don't own: " + r.data);
  const before = playerOf(g, O).money;
  r = await O.post("actions/travel", { ...ctx(gameId), squareId: 16 });
  check(r.status === 200 && r.data.frames.length > 0, "travel accepted with movement frames");
  g = await getGame(O, gameId);
  const me = playerOf(g, O);
  check(me.position === 16 && me.hasTraveled && !me.hasRolled, "O moved to 16 by subway and can still roll");
  check(me.money === before || me.money === before - 200, `money unchanged or mugged for 200 (${before} -> ${me.money})`);
  r = await O.post("actions/travel", { ...ctx(gameId), squareId: 6 });
  check(r.status === 400 && /already traveled/.test(r.data), "only one trip per turn: " + r.data);
  ({ game: g } = await forcedRoll(players, gameId, O, 1, 2));
  check(playerOf(g, O).position === 19, "roll after travelling moves from the new station");
  await endTurn(gameId, O);
  // another player landing on one of O's two stations pays the 2-station rate
  const payer = A; // Banker, no negotiation
  g = await walkTo(players, gameId, payer, 6);
  const paid = /Paid .* \$(\d+) in rent/.exec(g.results.description);
  check(paid && parseInt(paid[1]) === 50, "two stations collect $50 rent (got " + (paid ? paid[1] : "none") + ")");
  await endTurn(gameId, payer);
}

section("eliminations and ranking");
{
  g = await getGame(O, gameId);
  const seats = g.players.map((p) => p._id);
  // make sure it is C's turn, then C resigns: the turn must pass to the seat after C
  g = await untilTurnOf(players, gameId, C);
  r = await C.post("resignGame", { gameId });
  check(r.status === 200, "C resigns on their turn");
  g = await getGame(O, gameId);
  const cP = playerOf(g, C);
  check(cP.state === "Bankrupt" && cP.finishedRank === 3, "C is bankrupt and placed 3rd");
  const expectedNext = seats[(seats.indexOf(C.id) + 1) % seats.length];
  check(g.nextPlayerToAct === expectedNext, "turn passed to the next seat after C");
  check(g.squareState.every((s) => s.owner !== C.id), "C's properties released");
  r = await C.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 });
  check(r.status === 400, "bankrupt player cannot act");
  r = await C.post("current-session");
  check(r.data.currGameId === null, "resigned player detached");
  // A leaves (quits) during the active game: counts as a loss and ends the game
  r = await A.post("leaveGame", { gameId });
  check(r.status === 200, "A quits");
  g = await getGame(O, gameId);
  check(g.status === "Finished" && g.winner === O.username, "O wins");
  check(playerOf(g, O).finishedRank === 1 && playerOf(g, A).finishedRank === 2, "ranks 1 and 2 assigned");
  const stats = (await O.post("findPlayers")).data.players;
  const sO = stats.find((p) => p.playerId === O.id), sA = stats.find((p) => p.playerId === A.id), sC = stats.find((p) => p.playerId === C.id);
  check(sO.wins === 1 && sA.wins === 0 && sC.wins === 0, "win recorded");
  check(sO.gamesPlayed === 1 && sA.gamesPlayed === 1, "games played recorded");
  r = await O.post("current-session");
  check(r.data.currGameId === null, "winner detached from finished game");
  r = await O.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 });
  check(r.status === 400 && /active/.test(r.data), "no actions on a finished game");
}

section("turn timer auto-move (waits ~80s)");
{
  const T1 = await newUser("t1"), T2 = await newUser("t2");
  r = await T1.post("createGame", { data: { gameName: "Timed", maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, useTimers: true }, context: {} });
  const tid = r.data.gameId;
  await T1.post("joinGame", { gameId: tid, piece: "Car", playerClass: "Banker" });
  await T2.post("joinGame", { gameId: tid, piece: "Dog", playerClass: "Gambler" });
  let tg = await getGame(T1, tid);
  const first = byId([T1, T2], tg.nextPlayerToAct);
  const other = first === T1 ? T2 : T1;
  check(typeof tg.nextPlayerActBy === "string", "deadline set at start");
  r = await other.post("actions/timesUpAction", ctx(tid));
  tg = await getGame(T1, tid);
  check(tg.nextPlayerToAct === first.id && !playerOf(tg, first).hasRolled, "timesUp before the deadline does nothing");
  const waitMs = new Date(tg.nextPlayerActBy).getTime() - Date.now() + 1500;
  console.log(`    waiting ${Math.round(waitMs / 1000)}s for the deadline...`);
  await sleep(Math.max(0, waitMs));
  r = await other.post("actions/timesUpAction", ctx(tid));
  check(r.status === 200 && r.data.playerId === first.id && r.data.diceRoll, "timesUp auto-rolled for the idle player");
  tg = await getGame(T1, tid);
  const idle = playerOf(tg, first);
  check(idle.numTimeouts === 1, "timeout counted");
  check(tg.nextPlayerToAct === other.id || tg.auctionId != null || !idle.hasRolled, "turn moved on (or an auction opened, or a double keeps it open)");
  check(new Date(tg.nextPlayerActBy).getTime() > Date.now(), "new deadline is in the future");
  T1.close(); T2.close();
}

players.forEach((p) => p.close());
console.log(`\n${checks} checks, ${failures} failed`);
console.log(failures === 0 ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED");
process.exit(failures ? 1 : 0);
