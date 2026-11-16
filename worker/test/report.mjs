// Report a citizen: the player on turn spends a Corruption point to report
// another player. Believed (forced here), the target goes to quarantine;
// backfired, the reporter pays the false-report fine. Checks the refusals
// too: no Corruption, not your turn, yourself, someone already quarantined,
// and a second report in the same turn.
//
// Needs ENVIRONMENT=development (the outcome is forced).

const BASE = process.env.BASE || "http://localhost:8787";
const WS_BASE = BASE.replace(/^http/, "ws");
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

/** three players, none with Corruption to start (Banker, Gambler, Banker) */
const newGame = async (name) => {
  const classes = ["Banker", "Gambler", "Banker"];
  const pieces = ["Car", "Dog", "Cat"];
  const clients = [];
  for (let i = 0; i < 3; i++) {
    const c = new Client("p" + i);
    const s = suffix + name + i;
    const r = await c.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email: `rp${s}@t.com`, username: `rp${s}`.slice(0, 10), password: "pw-test-1", confirmPassword: "pw-test-1" });
    c.id = r.data.id;
    clients.push(c);
  }
  const r = await clients[0].post("createGame", { data: { gameName: "Report " + name, maxPlayers: 3, initialMoney: 1500, initialSkillPoints: 5, useTimers: true }, context: {} });
  const gameId = r.data.gameId;
  for (const c of clients) await c.connect(gameId);
  for (let i = 0; i < 3; i++) await clients[i].post("joinGame", { gameId, piece: pieces[i], playerClass: classes[i] });
  const game = (await clients[0].post("getGame", { gameId })).data.game;
  const cur = clients.find((c) => c.id === game.nextPlayerToAct);
  const [x, y] = clients.filter((c) => c !== cur);
  return { clients, gameId, cur, x, y };
};
const getGame = async (c, gameId) => (await c.post("getGame", { gameId })).data.game;
const player = (game, id) => game.players.find((p) => p._id === id);
const skillUp = async (c, gameId, skillType, times) => {
  for (let i = 0; i < times; i++) {
    const r = await c.post("actions/upgradeSkill", { context: { gameId }, skillType });
    if (r.status !== 200) throw new Error("upgradeSkill failed: " + JSON.stringify(r.data));
  }
};
const report = (c, gameId, target, forceOutcome) =>
  c.post("actions/reportCitizen", { context: { gameId }, targetId: target.id, forceOutcome });
const lastLog = (game) => game.log[game.log.length - 1]?.msg ?? "";
const closeAll = (clients) => clients.forEach((c) => c.ws.close());

// --- believed, and the refusals ------------------------------------------------
{
  const { clients, gameId, cur, x, y } = await newGame("b");

  let r = await report(cur, gameId, x, "believed");
  check(r.status !== 200 && /Corruption/.test(JSON.stringify(r.data)), "no Corruption: refused: " + JSON.stringify(r.data));

  r = await report(x, gameId, y, "believed");
  check(r.status !== 200 && /not your turn/i.test(JSON.stringify(r.data)), "not your turn: refused: " + JSON.stringify(r.data));

  await skillUp(cur, gameId, "Corruption", 2);

  r = await report(cur, gameId, cur, "believed");
  check(r.status !== 200 && /yourself/.test(JSON.stringify(r.data)), "reporting yourself: refused: " + JSON.stringify(r.data));

  const before = await getGame(cur, gameId);
  r = await report(cur, gameId, x, "believed");
  check(r.status === 200 && r.data.outcome === "believed", "report x (forced believed) -> " + r.status + " " + JSON.stringify(r.data));

  const game = await getGame(cur, gameId);
  const target = player(game, x.id);
  const me = player(game, cur.id);
  check(target.state === "In_Isolation" && target.position === 11 && target.numTurnsInIsolation === 0, "x is in quarantine on square 11: " + target.state + " @" + target.position);
  check(me.corruption === 1, "the report used up a Corruption point: " + me.corruption);
  check(me.money === player(before, cur.id).money, "a believed report costs no money");
  check(me.reportedOnTurn === (game.turnNumber ?? 0), "the turn of the report is recorded");
  check(/Reported .+ to the Ministry; .+ was sent to quarantine/.test(lastLog(game)), "logged: " + lastLog(game));

  r = await report(cur, gameId, x, "believed");
  check(r.status !== 200 && /already in quarantine/.test(JSON.stringify(r.data)), "x is already in quarantine: refused: " + JSON.stringify(r.data));

  r = await report(cur, gameId, y, "believed");
  check(r.status !== 200 && /already filed a report/.test(JSON.stringify(r.data)), "a second report this turn: refused: " + JSON.stringify(r.data));

  const snack = x.events.some((e) => e.event === "showSnackMsg" && /sent to quarantine/.test(JSON.stringify(e.args)));
  check(snack, "the table is told");
  closeAll(clients);
}

// --- backfired --------------------------------------------------------------------
{
  const { clients, gameId, cur, x } = await newGame("f");
  await skillUp(cur, gameId, "Corruption", 1);
  const before = await getGame(cur, gameId);

  const r = await report(cur, gameId, x, "backfired");
  check(r.status === 200 && r.data.outcome === "backfired", "report x (forced backfire) -> " + r.status + " " + JSON.stringify(r.data));

  const game = await getGame(cur, gameId);
  const me = player(game, cur.id);
  check(me.money === player(before, cur.id).money - 100, "fined $100: " + player(before, cur.id).money + " -> " + me.money);
  check(me.corruption === 0, "the Corruption point is spent anyway: " + me.corruption);
  check(player(game, x.id).state === "Active", "x stays free");
  check(/Filed a false report against .+ and was fined \$100/.test(lastLog(game)), "logged: " + lastLog(game));
  closeAll(clients);
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
