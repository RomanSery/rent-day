// Spectating: signed-in users may watch a public game while it is played,
// read-only, and nothing once it is over (no replays).
//
//   npm run dev                # in worker/
//   npm run test:api:watch

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
  connect(gameId, watch = false) {
    return new Promise((resolve) => {
      const ws = new WebSocket(WS_BASE + "/ws?gameId=" + gameId + (watch ? "&watch=1" : ""), { headers: { cookie: this.cookie } });
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

  lastWatchers() {
    const all = this.received("watchers");
    return all.length ? all[all.length - 1].args[0] : undefined;
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
  return c;
};
const gameData = (overrides = {}) => ({
  data: { gameName: "Watch me", maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, useTimers: false, ...overrides },
  context: {},
});

/** A started two-player game; returns its id. */
const startGame = async (a, b, overrides = {}) => {
  const r = await a.post("createGame", gameData(overrides));
  const gameId = r.data.gameId;
  const pwd = overrides.gamePwd ?? null;
  await a.post("joinGame", { gameId, piece: "Car", playerClass: "Banker", gamePwd: pwd });
  await b.post("joinGame", { gameId, piece: "Cat", playerClass: "Gambler", gamePwd: pwd });
  return gameId;
};

const alice = await newUser("al");
const bob = await newUser("bo");
const viv = await newUser("vi");
const walt = await newUser("wa");

console.log("a public game in progress");
const gameId = await startGame(alice, bob);
await alice.connect(gameId);
await bob.connect(gameId);

let r = await viv.post("findGames");
check(r.status === 200 && r.data.live?.some((g) => g.gameId === gameId), "listed under live games");
check(!r.data.games?.some((g) => g.gameId === gameId), "not listed as open to join");

r = await viv.post("getGame", { gameId });
check(r.status === 200 && r.data.game?._id === gameId, "spectator can load the game -> " + r.status);
check(!(await walt.connect(gameId)), "socket without watch=1 still refused");
check(await viv.connect(gameId, true), "spectator socket accepted");
viv.send("joinGameRoom", gameId);
await sleep(400);
check(viv.received("updateGameState").length > 0, "spectator gets the game state on joining the room");
check(viv.lastWatchers() === 1, "spectator told 1 watching -> " + viv.lastWatchers());
check(alice.lastWatchers() === 1, "players told 1 watching -> " + alice.lastWatchers());

console.log("spectators only listen");
alice.events = [];
viv.send("sendChatMsg", gameId, { msg: "hello from the stands" });
viv.send("showSnackMsg", gameId, "spectator snack");
viv.send("updateGameState", gameId);
await sleep(400);
check(alice.received("newChatMsg").length === 0, "spectator chat not forwarded");
check(alice.received("showSnackMsg").length === 0, "spectator snack not forwarded");
check(alice.received("updateGameState").length === 0, "spectator can't trigger broadcasts");
let game = (await alice.post("getGame", { gameId })).data.game;
check(!game.messages.some((m) => /stands/.test(m.msg)), "spectator chat not stored");
r = await viv.post("actions/roll", { context: { gameId } });
check(r.status === 400, "spectator can't roll -> " + r.status + " " + r.data);
r = await viv.post("actions/completeTurn", { context: { gameId } });
check(r.status === 400, "spectator can't end a turn -> " + r.status);
r = await viv.post("getSnapshots", { gameId });
check(r.status === 403, "snapshots stay players-only -> " + r.status);

console.log("spectator sees play");
viv.events = [];
const cur = game.nextPlayerToAct === alice.id ? alice : bob;
r = await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 2 });
check(r.status === 200, "player rolls -> " + r.status);
cur.send("stopAnimateDice", gameId);
cur.send("updateGameState", gameId);
await sleep(500);
check(viv.received("stopAnimateDice").length === 1, "spectator sees the dice");
check(viv.received("updateGameState").length >= 1, "spectator gets state updates");

console.log("watcher count");
check(await walt.connect(gameId, true), "second spectator accepted");
await sleep(300);
check(alice.lastWatchers() === 2, "players told 2 watching -> " + alice.lastWatchers());
walt.ws.close();
await sleep(500);
check(alice.lastWatchers() === 1, "back to 1 when one leaves -> " + alice.lastWatchers());

console.log("password-protected games");
{
  const c = await newUser("pc");
  const d = await newUser("pd");
  const pwGame = await startGame(c, d, { gamePwd: "secret" });
  r = await viv.post("findGames");
  check(!r.data.live?.some((g) => g.gameId === pwGame), "not listed");
  r = await viv.post("getGame", { gameId: pwGame });
  check(r.status === 403, "getGame refused -> " + r.status);
  const v2 = new Client("v2");
  v2.cookie = viv.cookie;
  check(!(await v2.connect(pwGame, true)), "spectator socket refused");
}

if (process.env.WATCH_IDLE) {
  // needs the Worker started with --var DEV_WATCH_IDLE_SECONDS:6 --var DEV_ACTIVITY_TOUCH_SECONDS:2
  console.log("abandoned games leave the list");
  await sleep(7000);
  r = await viv.post("findGames");
  check(!r.data.live?.some((g) => g.gameId === gameId), "no move for a while: not listed");
  // refused actions are not moves, whoever tries them
  r = await viv.post("actions/roll", { context: { gameId } });
  check(r.status === 400, "spectator's roll refused -> " + r.status);
  game = (await alice.post("getGame", { gameId })).data.game;
  const mover = game.nextPlayerToAct === alice.id ? alice : bob;
  r = await mover.post("actions/upgradeSkill", { context: { gameId }, skillType: "Fake" });
  check(r.status === 400, "player's bad request refused -> " + r.status);
  r = await viv.post("findGames");
  check(!r.data.live?.some((g) => g.gameId === gameId), "still not listed after refused actions");
  // a real move: a bid if an auction is open, else a roll or ending the turn.
  // The index records moves at most every DEV_ACTIVITY_TOUCH_SECONDS: wait that out
  await sleep(2500);
  if (game.auctionId) {
    r = await alice.post("actions/bid", { context: { gameId }, bid: 1 });
  } else {
    const moverPlayer = game.players.find((p) => p._id === mover.id);
    r = await mover.post(moverPlayer.hasRolled ? "actions/completeTurn" : "actions/roll", { context: { gameId } });
  }
  check(r.status === 200, "a player moves -> " + r.status + " " + JSON.stringify(r.data).slice(0, 60));
  r = await viv.post("findGames");
  const listed = r.data.live?.find((g) => g.gameId === gameId);
  check(!!listed, "listed again after the move");
  check(listed && Date.now() - Date.parse(listed.lastMoveAt) < 5000, "lastMoveAt is the latest move: " + listed?.lastMoveAt);
}

console.log("once the game is over");
alice.events = [];
viv.events = [];
await alice.post("resignGame", { gameId });
// the client asks for the new state to go out after resigning (resignCurrGame)
alice.send("updateGameState", gameId);
await sleep(800);
game = (await bob.post("getGame", { gameId })).data.game;
check(game.status === "Finished", "game finished after a resignation -> " + game.status);
check(viv.ws.readyState === WebSocket.OPEN, "connected spectator stays to see the end");
check(viv.received("updateGameState").some((e) => e.args[0]?.status === "Finished"), "spectator got the final state");
r = await walt.post("getGame", { gameId });
check(r.status === 403, "no replay: getGame refused -> " + r.status);
const late = new Client("late");
late.cookie = walt.cookie;
check(!(await late.connect(gameId, true)), "no replay: new spectator socket refused");
r = await walt.post("findGames");
check(!r.data.live?.some((g) => g.gameId === gameId), "no longer listed");

for (const c of [alice, bob, viv]) {
  try { c.ws?.close(); } catch {}
}

console.log(failures === 0 ? "\nall watch checks passed" : `\n${failures} watch check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
