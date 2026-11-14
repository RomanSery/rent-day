// Disconnect / rejoin scenarios: a player closes the browser or loses the
// connection and comes back. Development mode is needed for forced dice.
//
//   npm run test:api:rejoin   (or BASE=http://... node test/rejoin.mjs)

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
  constructor(name, cookie = "") { this.name = name; this.cookie = cookie; this.id = null; this.events = []; this.ws = null; }
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
      ws.addEventListener("close", (e) => { this.closedWith = { code: e.code, reason: e.reason }; });
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
let n = 0;
const newUser = async (label) => {
  const c = new Client(label);
  const u = `${label}${suffix}${n++}`.slice(0, 10);
  const r = await c.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email: `${u}@t.com`, username: u, password: "pw-test-1", confirmPassword: "pw-test-1" });
  if (r.status !== 200) throw new Error("createAccount failed: " + JSON.stringify(r.data));
  c.id = r.data.id;
  c.username = u;
  c.email = `${u}@t.com`;
  return c;
};
const ctx = (gameId) => ({ context: { gameId } });
const getGame = async (c, gameId) => (await c.post("getGame", { gameId })).data.game;

// =========================================================================
section("leaving the lobby page and coming back");
const A = await newUser("ra");
const B = await newUser("rb");
let r = await A.post("createGame", { data: { gameName: "Rejoin", maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, useTimers: false }, context: {} });
const gameId = r.data.gameId;
await A.connect(gameId);
await A.post("joinGame", { gameId, piece: "Car", playerClass: "Banker" });
A.close();
await sleep(200);
// "closing the browser": a fresh client with the same session cookie
let A2 = new Client("A-again", A.cookie);
A2.id = A.id;
r = await A2.post("current-session");
check(r.status === 200 && r.data.currGameId === gameId, "session still points at the lobby game");
let g = await getGame(A2, gameId);
check(g.status === "Joining" && g.players.some((p) => p._id === A.id), "A is still seated in the lobby");
await A2.connect(gameId);
A2.send("joinGameRoom", gameId, A.id, A.username);
await sleep(300);
check(A2.received("updateGameState").length === 1, "reconnecting to the lobby receives the current state");

section("disconnecting mid-game and missing a move");
await B.connect(gameId);
r = await B.post("joinGame", { gameId, piece: "Dog", playerClass: "Gambler" });
check(r.data.allJoined, "game starts");
g = await getGame(B, gameId);
const first = g.nextPlayerToAct === A.id ? A2 : B;
const other = first === A2 ? B : A2;
// make sure it is B's turn so A can be away while B moves
if (first !== B) {
  await A2.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 });
  g = await getGame(A2, gameId);
  if (g.auctionId) { await A2.post("actions/bid", { ...ctx(gameId), bid: 0 }); await B.post("actions/bid", { ...ctx(gameId), bid: 0 }); }
  await A2.post("actions/completeTurn", ctx(gameId));
}
g = await getGame(B, gameId);
check(g.nextPlayerToAct === B.id, "it is B's turn");

B.clear();
A2.close(); // A loses the connection
await sleep(300);
check(B.received("showSnackMsg").some((e) => /disconnected/.test(e.args[0])), "B is told A disconnected");

// B plays a full turn while A is away
r = await B.post("actions/roll", { ...ctx(gameId), forceDie1: 2, forceDie2: 3 });
check(r.status === 200, "B rolls while A is away");
B.send("stopAnimateDice", gameId, B.id, r.data.diceRoll, r.data.frames);
B.send("updateGameState", gameId);
g = await getGame(B, gameId);
if (g.auctionId) {
  // A is away: A never bids, so the auction stays open until A returns or the timer runs
  await B.post("actions/bid", { ...ctx(gameId), bid: 0 });
}
const stateWhileAway = await getGame(B, gameId);

section("the player returns");
const A3 = new Client("A-returns", A.cookie);
A3.id = A.id;
r = await A3.post("current-session");
check(r.data.currGameId === gameId, "session points at the active game");
g = await getGame(A3, gameId);
check(g.players.find((p) => p._id === B.id).position === stateWhileAway.players.find((p) => p._id === B.id).position, "state fetched on return includes B's move");
B.clear();
await A3.connect(gameId);
A3.send("joinGameRoom", gameId, A.id, A.username);
await sleep(400);
const pushed = A3.received("updateGameState");
check(pushed.length === 1 && pushed[0].args[0].players.find((p) => p._id === B.id).position === g.players.find((p) => p._id === B.id).position, "reconnect pushes the current state to the returning player");
check(B.received("showSnackMsg").some((e) => /re-connected/.test(e.args[0])), "B is told A re-connected");
if (stateWhileAway.auctionId) {
  check(A3.received("auctionUpdate").length === 1, "the open auction is pushed too");
  r = await A3.post("actions/bid", { ...ctx(gameId), bid: 0 });
  check(r.status === 200, "A can still bid in the auction opened while away");
}
g = await getGame(A3, gameId);
if (g.nextPlayerToAct === B.id && g.players.find((p) => p._id === B.id).hasRolled) {
  r = await B.post("actions/completeTurn", ctx(gameId));
  check(r.status === 200, "B ends the turn");
}
g = await getGame(A3, gameId);
check(g.nextPlayerToAct === A.id, "turn comes round to the returned player");
r = await A3.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 });
check(r.status === 200, "the returned player can act normally");

section("a server-side drop is survived by a reconnecting client");
{
  // the dev hook closes every socket of the sender; a real client reconnects
  // (the browser SocketService does this with backoff)
  A3.clear();
  A3.send("devDropConnection");
  await sleep(300);
  check(A3.closedWith && A3.closedWith.code === 4001, "socket closed by the server (code " + A3.closedWith?.code + ")");
  const A4 = new Client("A-reconnect", A.cookie);
  A4.id = A.id;
  await A4.connect(gameId);
  A4.send("joinGameRoom", gameId, A.id, A.username);
  await sleep(300);
  check(A4.received("updateGameState").length === 1, "state arrives again after reconnecting");
  A4.close();
}

B.close();
console.log(`\n${checks} checks, ${failures} failed`);
console.log(failures === 0 ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED");
process.exit(failures ? 1 : 0);
