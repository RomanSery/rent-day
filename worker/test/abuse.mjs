// What a malicious player could try: watching or spamming games they are not
// in, faking dice for everyone, rolling away an open auction, listing one
// property several times in a trade, and creating games outside the form's
// limits.
//
//   npm run dev                # in worker/ (ENVIRONMENT=development: forced dice)
//   npm run test:api:abuse
//
// With the Worker started with `--var DEV_LOBBY_SECONDS:4`, set LOBBY_EXPIRY=1
// to check that lobbies nobody fills are deleted.

const BASE = process.env.BASE || "http://localhost:8787";
const WS_BASE = BASE.replace(/^http/, "ws");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

const check = (cond, msg) => {
  if (cond) {
    console.log("  ok   " + msg);
  } else {
    failures++;
    console.log("  FAIL " + msg);
  }
};

class Client {
  constructor(name) {
    this.name = name;
    this.cookie = "";
    this.events = [];
    this.ws = null;
    this.closeCode = null;
  }

  async post(path, body) {
    const r = await fetch(BASE + "/api/" + path, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: this.cookie },
      body: JSON.stringify(body ?? {}),
    });
    const setCookies = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    if (setCookies.length) {
      this.cookie = setCookies.map((s) => s.split(";")[0]).join("; ");
    }
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: r.status, data };
  }

  /** Resolves true when the socket opens, false when the server refuses it. */
  connect(gameId) {
    return new Promise((resolve) => {
      const ws = new WebSocket(WS_BASE + "/ws?gameId=" + gameId, { headers: { cookie: this.cookie } });
      ws.addEventListener("open", () => resolve(true));
      ws.addEventListener("error", () => resolve(false));
      ws.addEventListener("close", (ev) => {
        this.closeCode = ev.code;
      });
      ws.addEventListener("message", (ev) => {
        try {
          this.events.push(JSON.parse(ev.data));
        } catch {}
      });
      this.ws = ws;
    });
  }

  send(event, ...args) {
    this.ws.send(JSON.stringify({ event, args }));
  }

  received(event) {
    return this.events.filter((e) => e.event === event);
  }
}

const suffix = Date.now().toString(36).slice(-5);
let n = 0;
const newUser = async (label) => {
  const c = new Client(label);
  const u = `${label}${suffix}${n++}`.slice(0, 10);
  const r = await c.post("createAccount", { email: `${u}@t.com`, username: u, password: "pw-test-1", confirmPassword: "pw-test-1" });
  if (r.status !== 200) throw new Error("createAccount failed: " + JSON.stringify(r.data));
  c.id = r.data.id;
  return c;
};
const ctx = (gameId) => ({ context: { gameId } });
const gameData = (overrides = {}) => ({
  data: { gameName: "Abuse", maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, useTimers: false, ...overrides },
  context: {},
});
const getGame = async (c, gameId) => (await c.post("getGame", { gameId })).data.game;

const alice = await newUser("al");
const bob = await newUser("bo");
const mallory = await newUser("ma");

console.log("createGame limits");
{
  let r = await mallory.post("createGame", gameData({ initialMoney: 1e300 }));
  check(r.status === 400, "initialMoney 1e300 rejected -> " + r.status);
  r = await mallory.post("createGame", gameData({ initialMoney: 1500.5 }));
  check(r.status === 400, "fractional money rejected -> " + r.status);
  r = await mallory.post("createGame", gameData({ maxPlayers: 2.5 }));
  check(r.status === 400, "maxPlayers 2.5 rejected -> " + r.status);
  r = await mallory.post("createGame", gameData({ initialSkillPoints: 1000 }));
  check(r.status === 400, "1000 skill points rejected -> " + r.status);
  r = await mallory.post("createGame", gameData({ gamePwd: "x".repeat(65) }));
  check(r.status === 400, "65-character game password rejected -> " + r.status);
  const ids = [];
  for (let i = 0; i < 3; i++) {
    r = await mallory.post("createGame", gameData({ gameName: "Spam " + i }));
    ids.push(r.data?.gameId);
  }
  check(ids.every(Boolean), "3 open lobbies allowed");
  r = await mallory.post("createGame", gameData({ gameName: "Spam 3" }));
  check(r.status === 429, "4th open lobby refused -> " + r.status);
}

console.log("a two-player game");
let r = await alice.post("createGame", gameData({ gameName: "Target" }));
const gameId = r.data.gameId;

// mallory may look at the lobby (that is how joining works)...
r = await mallory.post("getGame", { gameId });
check(r.status === 200 && r.data.game, "non-player can view a lobby");
check(await mallory.connect(gameId), "non-player can watch a lobby's socket");
mallory.send("sendChatMsg", gameId, { msg: "spam from outside" });
await sleep(300);

await alice.post("joinGame", { gameId, piece: "Car", playerClass: "Banker" });
await alice.connect(gameId);
await bob.connect(gameId);
r = await bob.post("joinGame", { gameId, piece: "Cat", playerClass: "Gambler" });
check(r.status === 200 && r.data.allJoined, "game starts");
await sleep(500);

let game = await getGame(alice, gameId);
check(!game.messages.some((m) => /outside/.test(m.msg)), "lobby watcher's chat was not stored");
check(mallory.closeCode === 4003, "watcher disconnected when the game started (code " + mallory.closeCode + ")");

console.log("non-players once the game is on");
{
  const m2 = await newUser("mb");
  check(!(await m2.connect(gameId)), "non-player socket refused");
  r = await m2.post("getGame", { gameId });
  check(r.status === 403, "getGame refused -> " + r.status);
  r = await m2.post("getSnapshots", { gameId });
  check(r.status === 403, "getSnapshots refused -> " + r.status);
  check(!(await m2.connect("0123456789abcdef01234567")), "socket to a game that doesn't exist refused");
}

console.log("chat limits");
{
  const cur = game.nextPlayerToAct === alice.id ? alice : bob;
  const other = cur === alice ? bob : alice;
  other.events = [];
  for (let i = 0; i < 20; i++) {
    cur.send("sendChatMsg", gameId, { msg: "flood " + i });
  }
  await sleep(800);
  game = await getGame(alice, gameId);
  const stored = game.messages.filter((m) => /^flood/.test(m.msg)).length;
  check(stored <= 6, `chat flood throttled: ${stored} of 20 stored`);
  check(cur.ws.readyState === WebSocket.OPEN, "sender not disconnected for a short burst");
}

console.log("fake dice");
{
  const cur = game.nextPlayerToAct === alice.id ? alice : bob;
  const other = cur === alice ? bob : alice;
  other.events = [];
  cur.send("stopAnimateDice", gameId, cur.id, { die1: -1, die2: 1 }, []);
  await sleep(400);
  check(other.received("stopAnimateDice").length === 0, "made-up dice are not forwarded");

  // a real roll: double 2+2 from Payday (1) lands on square 5, an unowned property
  r = await cur.post("actions/roll", { ...ctx(gameId), forceDie1: 2, forceDie2: 2 });
  check(r.status === 200, "double rolled -> " + r.status + " " + JSON.stringify(r.data).slice(0, 80));
  other.events = [];
  cur.send("stopAnimateDice", gameId, cur.id, { die1: 6, die2: 6 }, []);
  await sleep(400);
  const shown = other.received("stopAnimateDice")[0];
  check(shown && shown.args[1]?.die1 === 2 && shown.args[1]?.die2 === 2, "others see the server's dice: " + JSON.stringify(shown?.args?.[1]));

  game = await getGame(alice, gameId);
  check(!!game.auctionId, "landing opened an auction");
  r = await cur.post("actions/roll", { ...ctx(gameId), forceDie1: 1, forceDie2: 2 });
  check(r.status === 400 && /auction/.test(r.data), "can't roll again while the auction is open -> " + r.data);
  const g2 = await getGame(alice, gameId);
  check(g2.auctionId === game.auctionId, "the auction is still the same one");
  r = await other.post("getAuction", { auctionId: game.auctionId, ...ctx(gameId) });
  check(r.status === 200 && r.data.auction, "players can read the auction");
  const m3 = await newUser("mc");
  r = await m3.post("getAuction", { auctionId: game.auctionId, ...ctx(gameId) });
  check(r.status === 200 && r.data.auction === null, "non-players can't");
}

console.log("trades");
{
  const other = game.nextPlayerToAct === alice.id ? bob : alice;
  const cur = other === alice ? bob : alice;
  r = await cur.post("actions/offerTrade", { ...ctx(gameId), tradingWithPlayerId: other.id, mines: [5, 5, 5], theirs: [], myAmount: 0, theirAmount: 10 });
  check(r.status === 400 && /only be listed once/.test(r.data), "same property listed 3 times rejected -> " + r.data);
  r = await cur.post("actions/offerTrade", { ...ctx(gameId), tradingWithPlayerId: cur.id, mines: [], theirs: [], myAmount: 10, theirAmount: 10 });
  check(r.status === 400, "trading with yourself rejected -> " + r.data);
}

if (process.env.LOBBY_EXPIRY) {
  console.log("lobby expiry");
  const host = await newUser("lx");
  r = await host.post("createGame", gameData({ gameName: "Expiring" }));
  const lobbyId = r.data.gameId;
  check((await host.post("getGame", { gameId: lobbyId })).data.game != null, "lobby exists");
  await sleep(6500);
  r = await host.post("getGame", { gameId: lobbyId });
  check(r.status === 200 && r.data.game === null, "lobby deleted after it expired");
  r = await host.post("findGames", {});
  check(!r.data.games.some((g) => g.gameId === lobbyId), "and gone from the lobby list");
}

for (const c of [alice, bob, mallory]) {
  try {
    c.ws?.close();
  } catch {}
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall abuse checks passed");
process.exit(failures ? 1 : 0);
