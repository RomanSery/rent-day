// Verifies the delayed server event path (Durable Object alarm): in dev mode
// force a 1+1 roll from the start square so the player lands on Chance (3)
// and both clients should receive showChanceEvent about 5s later.

const BASE = process.env.BASE || "http://localhost:8787";
const WS_BASE = BASE.replace(/^http/, "ws");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (cond, msg) => {
  console.log((cond ? "  ok   " : "  FAIL ") + msg);
  if (!cond) failures++;
};

class Client {
  constructor(name) { this.name = name; this.cookie = ""; this.events = []; }
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
}

const suffix = Date.now().toString(36).slice(-5);
const a = new Client("a"), b = new Client("b");
let r = await a.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email: `ca${suffix}@t.com`, username: `ca${suffix}`, password: "pw-test-1", confirmPassword: "pw-test-1" });
a.id = r.data.id;
r = await b.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email: `cb${suffix}@t.com`, username: `cb${suffix}`, password: "pw-test-1", confirmPassword: "pw-test-1" });
b.id = r.data.id;

r = await a.post("createGame", { data: { gameName: "Chance", maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, useTimers: true }, context: {} });
const gameId = r.data.gameId;
await a.connect(gameId); await b.connect(gameId);
await a.post("joinGame", { gameId, piece: "Car", playerClass: "Banker" });
await b.post("joinGame", { gameId, piece: "Dog", playerClass: "Governor" });

let game = (await a.post("getGame", { gameId })).data.game;
check(game.status === "Active" && typeof game.nextPlayerActBy === "string", "game active with turn timer: " + game.nextPlayerActBy);
const cur = game.nextPlayerToAct === a.id ? a : b;

r = await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1 });
check(r.status === 200 && r.data.diceRoll.die1 === 1 && r.data.diceRoll.die2 === 1, "forced 1+1 roll accepted (dev mode)");
game = (await a.post("getGame", { gameId })).data.game;
const me = game.players.find((p) => p._id === cur.id);
check(game.log.length === 1 && /Landed on Chance|Payday|Governors|Wall/.test(game.log[0].msg), "log entry: " + game.log[0]?.msg);

check(a.events.filter((e) => e.event === "showChanceEvent").length === 0, "chance event not sent immediately");
await sleep(6000);
const ca = a.events.filter((e) => e.event === "showChanceEvent");
const cb = b.events.filter((e) => e.event === "showChanceEvent");
check(ca.length === 1 && cb.length === 1, "both clients received showChanceEvent after the 5s alarm");
check(ca.length === 1 && Array.isArray(ca[0].args[0]) && typeof ca[0].args[0][0].headline === "string", "payload wrapped in array with headline: " + JSON.stringify(ca[0]?.args[0]?.[0]?.headline));

// timesUp should do nothing while the turn timer is in the future (with the
// short dev timers the deadline may already have passed during the 6s wait)
game = (await a.post("getGame", { gameId })).data.game;
const deadlineAhead = new Date(game.nextPlayerActBy).getTime() > Date.now() + 500;
r = await b.post("actions/timesUpAction", { context: { gameId } });
check(r.status === 200, "timesUpAction -> " + r.status + " " + JSON.stringify(r.data));
game = (await a.post("getGame", { gameId })).data.game;
if (deadlineAhead) {
  check(game.nextPlayerToAct === cur.id && game.players.find((p) => p._id === cur.id).numTimeouts === 0, "turn not auto-moved early");
} else {
  console.log("    (deadline already passed under short timers; early-move check skipped)");
}

a.ws.close(); b.ws.close();
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
