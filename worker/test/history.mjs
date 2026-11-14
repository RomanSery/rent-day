// Game history and profiles: finished games are kept in D1 and summed up
// into a profile. Start the Worker with a fast bot pace:
//
//   npx wrangler dev --var DEV_BOT_PACE_MS:30
//   npm run test:api:history   (or BASE=http://... node test/history.mjs)

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
const profileOf = async (viewer, player) => (await viewer.post("getProfile", { playerId: player.id })).data.profile;

/** Wait until it is the human's turn with nothing rolled (bidding in bot auctions), or the game ends. */
const waitForHuman = async (human, gameId, timeoutMs = 30000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const g = await getGame(human, gameId);
    if (g.status !== "Active") return g;
    const me = g.players.find((p) => p._id === human.id);
    if (me.state === "Bankrupt") return g;
    if (g.nextPlayerToAct === human.id && !me.hasRolled && !g.auctionId && !g.lottoId) return g;
    if (g.auctionId) {
      const auction = (await human.post("getAuction", { ...ctx(gameId), auctionId: g.auctionId })).data.auction;
      const mine = auction?.bidders.find((b) => b._id === human.id);
      if (mine && !mine.submittedBid) await human.post("actions/bid", { ...ctx(gameId), bid: 0 });
    }
    await sleep(150);
  }
  throw new Error("the turn never came back to " + human.name);
};

/** One turn that buys whatever the human lands on (outbids bots by a lot). */
const buyingTurn = async (human, gameId) => {
  const r = await human.post("actions/roll", ctx(gameId));
  if (r.status !== 200) return;
  let g = await getGame(human, gameId);
  if (g.auctionId) {
    await human.post("actions/bid", { ...ctx(gameId), bid: 400 });
    const start = Date.now();
    while (Date.now() - start < 15000) {
      g = await getGame(human, gameId);
      if (!g.auctionId) break;
      await sleep(100);
    }
  }
  if (g.pendingChance?.playerId === human.id) {
    // a choice card (Detour): take the first option
    await human.post("actions/chanceChoice", { ...ctx(gameId), choice: g.pendingChance.choices[0].key });
    g = await getGame(human, gameId);
  }
  if (g.lottoId) {
    await human.post("actions/pickLotto", { ...ctx(gameId), opt: 1 });
    g = await getGame(human, gameId);
  }
  const me = g.players.find((p) => p._id === human.id);
  if (g.status !== "Active" || me.state === "Bankrupt") return;
  if (!me.hasRolled) return buyingTurn(human, gameId); // doubles
  await human.post("actions/completeTurn", ctx(gameId));
};

// =========================================================================
section("access");
const alice = await newUser("al");
const bob = await newUser("bo");
let r = await new Client("anon").post("getProfile", { playerId: alice.id });
check(r.status === 400 && !r.data.profile, "signed out: no profiles (" + r.status + ")");
r = await alice.post("getProfile", { playerId: "0123456789abcdef01234567" });
check(r.status === 404, "unknown player -> 404 (" + r.status + ")");
r = await alice.post("getProfile", { playerId: "not-an-id" });
check(r.status === 404, "malformed id -> 404 (" + r.status + ")");

let p = await profileOf(bob, alice);
check(p && p.name === alice.username && p.historyGames === 0 && p.recentGames.length === 0, "a new player has an empty history");

section("a two-player game: bob resigns, alice wins");
r = await alice.post("createGame", { data: { gameName: "History H2H", maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5 }, context: {} });
const g1 = r.data.gameId;
await alice.post("joinGame", { gameId: g1, piece: "Car", playerClass: "Banker" });
r = await bob.post("joinGame", { gameId: g1, piece: "Cat", playerClass: "Gambler" });
check(r.data.allJoined === true, "game started");
r = await bob.post("resignGame", { gameId: g1 });
check(r.status === 200, "bob resigns");
const end1 = await getGame(alice, g1);
check(end1.status === "Finished", "game finished");

p = await profileOf(bob, alice);
check(p.historyGames === 1, "alice: 1 game in the history (" + p.historyGames + ")");
const game1 = p.recentGames[0];
check(game1 && game1.gameId === g1 && game1.won && game1.rank === 1 && game1.name === "History H2H", "alice: the game is listed as a win");
check(game1 && game1.seats.length === 2 && game1.seats.some((s) => s.id === bob.id && s.rank === 2 && !s.bot), "the game lists both seats with ranks");
check(p.classes.length === 1 && p.classes[0].playerClass === "Banker" && p.classes[0].wins === 1 && p.classes[0].games === 1, "alice: Banker 1 of 1");
const vsBob = p.opponents.find((o) => o.playerId === bob.id);
check(vsBob && vsBob.games === 1 && vsBob.ahead === 1 && vsBob.behind === 0 && vsBob.name === bob.username, "alice: ahead of bob 1-0");

p = await profileOf(alice, bob);
check(p.historyGames === 1 && !p.recentGames[0].won && p.recentGames[0].rank === 2, "bob: the game is listed as a loss");
check(p.classes[0].playerClass === "Gambler" && p.classes[0].wins === 0, "bob: Gambler 0 of 1");
const vsAlice = p.opponents.find((o) => o.playerId === alice.id);
check(vsAlice && vsAlice.ahead === 0 && vsAlice.behind === 1, "bob: behind alice 0-1");
check(p.losses >= 1, "bob's account counts the loss");

section("recorded once: more requests on the finished game add nothing");
await alice.post("getGame", { gameId: g1 });
await alice.post("resignGame", { gameId: g1 });
p = await profileOf(bob, alice);
check(p.historyGames === 1, "still 1 game (" + p.historyGames + ")");

section("alice against two computer players, buying property, then leaving");
r = await alice.post("createGame", { data: { gameName: "History Bots", maxPlayers: 3, initialMoney: 1500, initialSkillPoints: 5, numBots: 2, botLevel: "Normal" }, context: {} });
const g2 = r.data.gameId;
r = await alice.post("joinGame", { gameId: g2, piece: "Car", playerClass: "Conductor" });
check(r.data.allJoined === true, "game started");
let owned = 0;
for (let i = 0; i < 12 && owned < 2; i++) {
  const g = await waitForHuman(alice, g2);
  if (g.status !== "Active") break;
  await buyingTurn(alice, g2);
  owned = (await getGame(alice, g2)).squareState.filter((s) => s.owner === alice.id).length;
}
console.log(`    alice owns ${owned} properties`);
await waitForHuman(alice, g2);
r = await alice.post("resignGame", { gameId: g2 });
check(r.status === 200, "alice resigns");
const end2 = await getGame(alice, g2);
check(end2.status === "Finished", "with no human left the game ends");

p = await profileOf(bob, alice);
check(p.historyGames === 2, "alice: 2 games in the history (" + p.historyGames + ")");
check(p.recentGames[0].gameId === g2 && !p.recentGames[0].won, "newest first: the bot game, lost");
check(p.recentGames[0].seats.filter((s) => s.bot).length === 2, "the bot game lists the computer players");
check(p.recentGames[0].finalWorth === 0 && p.recentGames[0].seats.find((s) => s.id === alice.id)?.worth === 0, "a player who resigned finishes with nothing");
check(p.recentGames[1].seats.find((s) => s.id === bob.id)?.worth === 0 && p.recentGames[1].seats.find((s) => s.id === alice.id)?.worth > 0, "the winner keeps their net worth; the one who resigned has none");
const cond = p.classes.find((c) => c.playerClass === "Conductor");
check(cond && cond.games === 1 && cond.wins === 0, "alice: Conductor 0 of 1");
const vsBots = p.opponents.find((o) => o.bot);
check(vsBots && vsBots.games === 1 && vsBots.behind === 1, "alice: one game behind the computer players");
check(p.opponents[p.opponents.length - 1].bot, "computer players come after people");
if (owned > 0) {
  check(p.favouriteProperties.length > 0 && p.favouriteProperties.every((f) => f.name && f.games >= 1 && f.turnsHeld >= 1), "favourite properties are named, with games and turns held");
} else {
  console.log("    (alice bought nothing, skipping the favourite properties check)");
}
check(p.recentGames[0].turns > 0, "the bot game counted its turns (" + p.recentGames[0].turns + ")");

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
