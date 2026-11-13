// Computer player scenarios. Run the Worker in development mode with a fast
// bot pace, e.g.  npx wrangler dev --var DEV_BOT_PACE_MS:30
//
//   npm run test:api:bots   (or BASE=http://... node test/bots.mjs)

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

class Client {
  constructor(name) { this.name = name; this.cookie = ""; this.id = null; this.events = []; this.ws = null; }
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
  received(event) { return this.events.filter((e) => e.event === event); }
  close() { try { this.ws?.close(); } catch {} }
}

const suffix = Date.now().toString(36).slice(-5);
let n = 0;
const newUser = async (label) => {
  const c = new Client(label);
  const u = `${label}${suffix}${n++}`.slice(0, 10);
  const r = await c.post("createAccount", { email: `${u}@t.com`, username: u, password: "pw-test-1", confirmPassword: "pw-test-1" });
  if (r.status !== 200) throw new Error("createAccount failed: " + JSON.stringify(r.data));
  c.id = r.data.id;
  c.username = u;
  return c;
};

const ctx = (gameId) => ({ context: { gameId } });
const getGame = async (c, gameId) => (await c.post("getGame", { gameId })).data.game;
const playerOf = (game, c) => game.players.find((p) => p._id === c.id);
const bots = (game) => game.players.filter((p) => p.isBot);

/** Wait until it is the human's turn with nothing rolled, or the game ends. */
const waitForHuman = async (human, gameId, timeoutMs = 20000) => {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    const g = await getGame(human, gameId);
    last = g;
    if (g.status !== "Active") return g;
    const me = playerOf(g, human);
    if (g.nextPlayerToAct === human.id && !me.hasRolled && !g.auctionId && !g.lottoId) return g;
    if (g.nextPlayerToAct === human.id && me.state === "Bankrupt") return g;
    if (g.auctionId && me.state !== "Bankrupt") {
      // humans bid in every auction, including the ones bots open
      const auction = (await human.post("getAuction", { ...ctx(gameId), auctionId: g.auctionId })).data.auction;
      const mine = auction?.bidders.find((b) => b._id === human.id);
      if (mine && !mine.submittedBid) {
        await human.post("actions/bid", { ...ctx(gameId), bid: 10 });
        human.humanBids = (human.humanBids ?? 0) + 1;
      }
    }
    await sleep(150);
  }
  throw new Error("bots did not hand the turn back in time; last state: next=" + last?.nextPlayerToAct + " auction=" + last?.auctionId + " status=" + last?.status);
};

/** The human takes one quick turn: roll, bid in any auction, pick any lotto, end turn. */
const humanTurn = async (human, gameId, bid = 0) => {
  let r = await human.post("actions/roll", ctx(gameId));
  if (r.status !== 200) return { ok: false, msg: r.data };
  let g = await getGame(human, gameId);
  if (g.auctionId) {
    await human.post("actions/bid", { ...ctx(gameId), bid });
    // bots bid on their own; wait for the auction to close
    const start = Date.now();
    while (Date.now() - start < 15000) {
      g = await getGame(human, gameId);
      if (!g.auctionId) break;
      await sleep(100);
    }
  }
  if (g.lottoId) {
    await human.post("actions/pickLotto", { ...ctx(gameId), opt: 1 });
    g = await getGame(human, gameId);
  }
  const me = playerOf(g, human);
  if (me.state === "Bankrupt" || g.status !== "Active") return { ok: true, game: g };
  if (!me.hasRolled) return humanTurn(human, gameId, bid); // rolled a double
  if (me.money < 0) {
    // sell/mortgage like a sensible human would
    for (const s of g.squareState.filter((s) => s.owner === human.id && s.numHouses > 0)) await human.post("actions/sellHouse", { ...ctx(gameId), squareId: s.squareId });
    for (const s of g.squareState.filter((s) => s.owner === human.id && !s.isMortgaged)) await human.post("actions/mortgage", { ...ctx(gameId), squareId: s.squareId });
  }
  r = await human.post("actions/completeTurn", ctx(gameId));
  return { ok: r.status === 200, msg: r.data, game: await getGame(human, gameId) };
};

// =========================================================================
section("sanity: fast bot pace");
const H = await newUser("h");
let r = await H.post("createGame", { data: { gameName: "Solo", maxPlayers: 3, initialMoney: 1500, initialSkillPoints: 5, numBots: 2, botLevel: "Normal" }, context: {} });
check(r.status === 200, "create a game with two computer players");
const gameId = r.data.gameId;
let g = await getGame(H, gameId);
check(g.players.length === 2 && bots(g).length === 2 && g.status === "Joining", "bots are seated before the human joins");
check(new Set(g.players.map((p) => p.type)).size === 2 && new Set(g.players.map((p) => p.name)).size === 2, "bots have distinct pieces and names");
r = await H.post("findGames");
const listed = r.data.games.find((x) => x.gameId === gameId);
check(listed && listed.playersJoined === 2 && listed.bots === 2, "lobby lists the game with 2 computer players");

r = await H.post("createGame", { data: { gameName: "Bad", maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, numBots: 2 }, context: {} });
check(r.status === 400, "cannot fill every seat with bots");

section("the game starts when the human joins and bots play their turns");
await H.connect(gameId);
r = await H.post("joinGame", { gameId, piece: "Car", playerClass: "Banker" });
check(r.status === 200 && r.data.allJoined, "human joins -> game starts");
const t0 = Date.now();
g = await waitForHuman(H, gameId, 30000);
check(g.status === "Active", "game active");
const botsMovedBeforeHuman = bots(g).filter((p) => p.position !== 1 || p.rollHistory.length > 0).length;
console.log(`    waited ${Date.now() - t0}ms for the human's turn; ${botsMovedBeforeHuman} bot(s) moved first`);
check(H.received("animateDice").length >= botsMovedBeforeHuman, "dice animation events sent for bot rolls");
check(H.received("stopAnimateDice").length >= botsMovedBeforeHuman, "movement frames sent for bot rolls");
if (botsMovedBeforeHuman > 0) {
  check(H.received("updateGameState").length >= 1, "state refresh sent after bot actions");
}

const tradeChecks = async () => {
  section("trades offered to a bot get answered");
{
  g = await getGame(H, gameId);
  if (g.status === "Active") {
    const bot = bots(g).find((b) => b.state !== "Bankrupt");
    const humanMoney = playerOf(g, H).money;
    // a gift of money: any bot should accept
    r = await H.post("actions/offerTrade", { ...ctx(gameId), tradingWithPlayerId: bot._id, mines: [], theirs: [], myAmount: Math.min(50, humanMoney), theirAmount: 1 });
    check(r.status === 200, "offer a generous trade to a bot");
    const tradeId = r.data.newTradeId;
    let trade = null;
    for (let i = 0; i < 40; i++) {
      await sleep(100);
      const reviewed = H.received("tradeOfferReviewed").find((e) => e.args[0]?._id === tradeId);
      if (reviewed) { trade = reviewed.args[0]; break; }
    }
    check(trade && trade.status === "Accepted", "bot accepted the generous trade (" + (trade?.status ?? "no answer") + ")");
    // an insulting trade: bot should decline
    const botSquare = g.squareState.find((s) => s.owner === bot._id && s.numHouses === 0 && !s.isMortgaged);
    if (botSquare) {
      r = await H.post("actions/offerTrade", { ...ctx(gameId), tradingWithPlayerId: bot._id, mines: [], theirs: [botSquare.squareId], myAmount: 1, theirAmount: 0 });
      const t2 = r.data.newTradeId;
      let trade2 = null;
      for (let i = 0; i < 40; i++) {
        await sleep(100);
        const reviewed = H.received("tradeOfferReviewed").find((e) => e.args[0]?._id === t2);
        if (reviewed) { trade2 = reviewed.args[0]; break; }
      }
      check(trade2 && trade2.status === "Declined", "bot declined selling a property for $1 (" + (trade2?.status ?? "no answer") + ")");
    }
  } else {
    console.log("    (game already over, skipping trade checks)");
  }
}
};

section("a full game loop with bots bidding, building and ending turns");
{
  let rounds = 0;
  let botsBought = false;
  let botBuilt = false;
  let botBidOnHumanAuction = false;
  const start = Date.now();
  while (rounds < 40 && Date.now() - start < 120000) {
    g = await waitForHuman(H, gameId, 30000);
    if (g.status !== "Active" || playerOf(g, H).state === "Bankrupt") break;
    const beforeAuctionCount = H.received("auctionUpdate").length;
    const res = await humanTurn(H, gameId, 25);
    if (!res.ok) { console.log("    human turn problem: " + res.msg); break; }
    rounds++;
    g = res.game;
    if (rounds === 4) {
      await tradeChecks();
      section("a full game loop with bots bidding, building and ending turns (continued)");
    }
    if (H.received("auctionUpdate").length > beforeAuctionCount) botBidOnHumanAuction = true;
    if (g.squareState.some((s) => s.owner && bots(g).some((b) => b._id === s.owner))) botsBought = true;
    if (g.squareState.some((s) => s.numHouses > 0 && bots(g).some((b) => b._id === s.owner))) botBuilt = true;
  }
  console.log(`    played ${rounds} human turns in ${Math.round((Date.now() - start) / 1000)}s; status=${g.status}; human bid in ${H.humanBids ?? 0} bot auctions`);
  check((H.humanBids ?? 0) > 0, "bots opened auctions the human had to bid in");
  check(rounds >= 10 || g.status !== "Active", "the loop kept flowing (bots never stalled the game)");
  check(botsBought, "bots won auctions and own property");
  check(botBidOnHumanAuction, "bots bid in auctions the human opened");
  const botLog = g.log.filter((l) => bots(g).some((b) => l.msg.includes(b.name)));
  check(botLog.length >= 5, `bot moves recorded in the game log (${botLog.length} entries)`);
  console.log("    bots built houses: " + botBuilt);
  const skillSpent = bots(g).some((b) => b.numAbilityPoints === 0 && (b.luck + b.negotiation + b.corruption) > 2);
  check(skillSpent, "bots spent their skill points");
}

section("the game ends when the last human leaves");
{
  g = await getGame(H, gameId);
  if (g.status === "Active") {
    r = await H.post("resignGame", { gameId });
    check(r.status === 200, "human resigns");
    await sleep(500);
    g = await getGame(H, gameId);
    check(g.status === "Finished", "game finished rather than bots playing on");
    const ranks = g.players.map((p) => p.finishedRank).sort();
    check(ranks.join(",") === "1,2,3", "every player ranked (" + ranks.join(",") + ")");
    check(bots(g).some((b) => b.name === g.winner), "a bot is declared the winner");
  } else {
    check(g.status === "Finished", "game finished during play (human went bankrupt)");
  }
  r = await H.post("current-session");
  check(r.data.currGameId === null, "human detached from the finished game");
  r = await H.post("findPlayers");
  check(!r.data.players.some((p) => bots(g).some((b) => b._id === p.playerId)), "bots are not listed on the players leaderboard");
}

section("adding bots from the lobby");
{
  const A = await newUser("a"), B = await newUser("b");
  r = await A.post("createGame", { data: { gameName: "Lobby bots", maxPlayers: 3, initialMoney: 1500, initialSkillPoints: 5 }, context: {} });
  const gid = r.data.gameId;
  await A.connect(gid);
  await B.connect(gid);
  await A.post("joinGame", { gameId: gid, piece: "Car", playerClass: "Banker" });
  r = await B.post("addBot", { gameId: gid, level: "Easy" });
  check(r.status === 400 && /creator/.test(r.data), "only the creator can add bots: " + r.data);
  r = await A.post("addBot", { gameId: gid, level: "Easy" });
  check(r.status === 200 && r.data.allJoined === false, "creator adds an Easy bot");
  await sleep(200);
  check(B.received("joinedGame").some((e) => e.args[0].playerName === r.data.playerName), "lobby broadcast announces the bot");
  g = await getGame(A, gid);
  check(bots(g).length === 1 && bots(g)[0].botLevel === "Easy", "bot stored with its level");
  r = await B.post("joinGame", { gameId: gid, piece: "Dog", playerClass: "Gambler" });
  check(r.status === 200 && r.data.allJoined, "second human fills the last seat");
  r = await A.post("addBot", { gameId: gid, level: "Normal" });
  check(r.status === 400, "cannot add bots once started");
  // creator leaves the lobby of another game: bots are removed when no human remains
  const C = await newUser("c");
  r = await C.post("createGame", { data: { gameName: "Abandoned", maxPlayers: 3, initialMoney: 1500, initialSkillPoints: 5, numBots: 1 }, context: {} });
  const gid2 = r.data.gameId;
  await C.post("joinGame", { gameId: gid2, piece: "Car", playerClass: "Banker" });
  await C.post("leaveGame", { gameId: gid2 });
  g = await getGame(C, gid2);
  check(g.players.length === 0, "bots leave an abandoned lobby");
  A.close(); B.close();
}

section("bots can't take the creator's seat");
{
  const D = await newUser("d");
  r = await D.post("createGame", { data: { gameName: "Saved seat", maxPlayers: 3, initialMoney: 1500, initialSkillPoints: 5 }, context: {} });
  const gid = r.data.gameId;
  r = await D.post("addBot", { gameId: gid, level: "Easy" });
  check(r.status === 200 && r.data.allJoined === false, "creator adds a bot before joining");
  r = await D.post("addBot", { gameId: gid, level: "Easy" });
  check(r.status === 200 && r.data.allJoined === false, "and a second, leaving one seat open");
  r = await D.post("addBot", { gameId: gid, level: "Easy" });
  check(r.status === 400 && /kept for you/.test(r.data), "the last seat stays the creator's while they haven't joined: " + r.data);
  g = await getGame(D, gid);
  check(g.players.length === 2 && g.status === "Joining", "game still waiting, two bots seated");
  // bots pick pieces at random; take one that's still free
  const freePiece = ["Pawn", "Hat", "Car", "Bicycle", "Cat", "Dog"].find((p) => !g.players.some((pl) => pl.type === p));
  r = await D.post("joinGame", { gameId: gid, piece: freePiece, playerClass: "Governor" });
  check(r.status === 200 && r.data.allJoined, "creator joins the kept seat and the game starts: " + r.status + " " + JSON.stringify(r.data));
}

H.close();
console.log(`\n${checks} checks, ${failures} failed`);
console.log(failures === 0 ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED");
process.exit(failures ? 1 : 0);
