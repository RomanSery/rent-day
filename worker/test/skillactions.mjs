// Skill-point actions (SkillActionProcessor): forged vaccine card (Luck),
// hardship plea (Negotiation), bribe the guard (Corruption). Each uses up a
// point; checks what each does and when each is refused.
//
// Needs ENVIRONMENT=development (forced dice, forced report outcome,
// /api/dev/setPlayer).

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

/** two players with no skills to start (both Bankers) */
const newGame = async (name) => {
  const clients = [];
  for (let i = 0; i < 2; i++) {
    const c = new Client("p" + i);
    const s = suffix + name + i;
    const r = await c.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email: `sk${s}@t.com`, username: `sk${s}`.slice(0, 10), password: "pw-test-1", confirmPassword: "pw-test-1" });
    c.id = r.data.id;
    clients.push(c);
  }
  const r = await clients[0].post("createGame", { data: { gameName: "Skills " + name, maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, useTimers: true }, context: {} });
  const gameId = r.data.gameId;
  for (const c of clients) await c.connect(gameId);
  await clients[0].post("joinGame", { gameId, piece: "Car", playerClass: "Banker" });
  await clients[1].post("joinGame", { gameId, piece: "Dog", playerClass: "Banker" });
  const game = (await clients[0].post("getGame", { gameId })).data.game;
  const cur = clients.find((c) => c.id === game.nextPlayerToAct);
  const other = clients.find((c) => c !== cur);
  return { clients, gameId, cur, other };
};
const getGame = async (c, gameId) => (await c.post("getGame", { gameId })).data.game;
const player = (game, id) => game.players.find((p) => p._id === id);
const skillUp = async (c, gameId, skillType, times) => {
  for (let i = 0; i < times; i++) {
    const r = await c.post("actions/upgradeSkill", { context: { gameId }, skillType });
    if (r.status !== 200) throw new Error("upgradeSkill failed: " + JSON.stringify(r.data));
  }
};
const act = (c, gameId, action) => c.post("actions/skillAction", { context: { gameId }, action });
const roll = (c, gameId, d1, d2) => c.post("actions/roll", { context: { gameId }, forceDie1: d1, forceDie2: d2 });
const endTurn = (c, gameId) => c.post("actions/completeTurn", { context: { gameId } });
const err = (r) => JSON.stringify(r.data);
const closeAll = (clients) => clients.forEach((c) => c.ws.close());

// --- forged vaccine card: three doubles onto Big Brother ---------------------------
{
  const { clients, gameId, cur, other } = await newGame("f");

  let r = await act(cur, gameId, "forgeCard");
  check(r.status !== 200 && /Luck/.test(err(r)), "no Luck: refused: " + err(r));
  r = await act(other, gameId, "forgeCard");
  check(r.status !== 200 && /not your turn/i.test(err(r)), "not your turn: refused: " + err(r));
  r = await act(cur, gameId, "bogus");
  check(r.status !== 200, "an unknown action is refused -> " + r.status);

  await skillUp(cur, gameId, "Luck", 2);
  r = await act(cur, gameId, "forgeCard");
  let game = await getGame(cur, gameId);
  check(r.status === 200 && player(game, cur.id).hasForgedCard === true, "forged a card -> " + r.status);
  check(player(game, cur.id).luck === 1, "it used up a Luck point: " + player(game, cur.id).luck);
  r = await act(cur, gameId, "forgeCard");
  check(r.status !== 200 && /already carry/.test(err(r)), "only one at a time: " + err(r));

  // 1 -> 11 (just visiting) -> 21 (park) -> third double, onto Big Brother (31)
  await roll(cur, gameId, 5, 5);
  await roll(cur, gameId, 5, 5);
  r = await roll(cur, gameId, 5, 5);
  check(r.status === 200, "third double rolled -> " + r.status);
  game = await getGame(cur, gameId);
  const me = player(game, cur.id);
  check(me.state === "Active" && me.position === 31, "waved through: still free, on Big Brother: " + me.state + " @" + me.position);
  check(me.hasForgedCard !== true, "the card is used up");
  check(me.hasRolled === true, "the third double still ends the rolling");
  check(/Showed a forged vaccine card and stayed out of quarantine/.test(game.log[game.log.length - 1].msg), "logged: " + game.log[game.log.length - 1].msg);
  r = await endTurn(cur, gameId);
  check(r.status === 200, "the turn can end -> " + r.status);
  closeAll(clients);
}

// --- forged vaccine card against a report ------------------------------------------
{
  const { clients, gameId, cur, other } = await newGame("r");
  await skillUp(cur, gameId, "Luck", 1);
  await act(cur, gameId, "forgeCard");
  await roll(cur, gameId, 4, 6); // to 11, just visiting
  await endTurn(cur, gameId);

  await skillUp(other, gameId, "Corruption", 1);
  const r = await other.post("actions/reportCitizen", { context: { gameId }, targetId: cur.id, forceOutcome: "believed" });
  check(r.status === 200 && r.data.outcome === "papers", "a believed report meets forged papers: " + err(r));
  const game = await getGame(cur, gameId);
  check(player(game, cur.id).state === "Active" && player(game, cur.id).hasForgedCard !== true, "the target stays free and the card is used up");
  check(player(game, other.id).corruption === 0, "the reporter's Corruption point is spent anyway");
  closeAll(clients);
}

// --- bribe the guard ---------------------------------------------------------------
{
  const { clients, gameId, cur, other } = await newGame("b");
  await skillUp(cur, gameId, "Corruption", 1);
  let r = await act(cur, gameId, "bribeGuard");
  check(r.status !== 200 && /not in quarantine/.test(err(r)), "not in quarantine: refused: " + err(r));

  // three doubles: off to quarantine
  await roll(cur, gameId, 5, 5);
  await roll(cur, gameId, 5, 5);
  await roll(cur, gameId, 5, 5);
  let game = await getGame(cur, gameId);
  check(player(game, cur.id).state === "In_Isolation", "three doubles without papers: quarantined");
  await endTurn(cur, gameId);
  await roll(other, gameId, 4, 6); // to 11, just visiting: nothing to buy
  await endTurn(other, gameId);

  game = await getGame(cur, gameId);
  const before = player(game, cur.id);
  check(game.nextPlayerToAct === cur.id && before.state === "In_Isolation", "back to the quarantined player");
  r = await act(cur, gameId, "bribeGuard");
  check(r.status === 200, "bribed the guard -> " + r.status + " " + err(r));
  game = await getGame(cur, gameId);
  const after = player(game, cur.id);
  check(after.state === "Active" && after.position === 11, "out of quarantine, still on its square: " + after.state + " @" + after.position);
  check(after.corruption === before.corruption - 1, "it used up a Corruption point: " + after.corruption);
  check(after.money === before.money, "and no money");
  r = await roll(cur, gameId, 4, 6); // to 21, the closed park: nothing to buy
  game = await getGame(cur, gameId);
  check(r.status === 200 && player(game, cur.id).position === 21, "then rolls as normal: @" + player(game, cur.id).position);
  await skillUp(cur, gameId, "Corruption", 1);
  r = await act(cur, gameId, "bribeGuard");
  check(r.status !== 200 && /not in quarantine/.test(err(r)), "no second bribe once out: " + err(r));
  closeAll(clients);
}

// --- hardship plea: half the rent ------------------------------------------------------
/** rent paid landing on Forest Hills (12), with the owner holding the whole group */
const rentPaid = async (negotiation, plead) => {
  const { clients, gameId, cur, other } = await newGame(plead ? "h" : "c");
  await cur.post("dev/setPlayer", { gameId, playerId: other.id, squareIds: [12, 14, 15], purchasePrice: 200 });
  await skillUp(cur, gameId, "Negotiation", negotiation);
  const extra = {};
  if (plead) {
    let r = await act(cur, gameId, "hardshipPlea");
    extra.pleaded = r.status === 200;
    r = await act(cur, gameId, "hardshipPlea");
    extra.secondRefused = r.status !== 200 && /already pleaded/.test(err(r));
  }
  let game = await getGame(cur, gameId);
  const before = player(game, cur.id).money;
  const negotiationAfter = player(game, cur.id).negotiation;
  await roll(cur, gameId, 5, 6); // 1 + 11 = 12
  game = await getGame(cur, gameId);
  const paid = before - player(game, cur.id).money;
  if (plead) {
    const r = await act(cur, gameId, "hardshipPlea");
    extra.afterRollRefused = r.status !== 200;
    extra.halvedBadge = player(game, cur.id).hardshipTurn === (game.turnNumber ?? 0);
  }
  closeAll(clients);
  return { paid, negotiationAfter, position: player(game, cur.id).position, ...extra };
};
{
  // same Negotiation (1) when the rent is paid: one without a plea, one that spent its second point on one
  const control = await rentPaid(1, false);
  const pleaded = await rentPaid(2, true);
  check(control.position === 12 && control.paid > 0, "rent paid without a plea: $" + control.paid);
  check(pleaded.pleaded && pleaded.negotiationAfter === 1, "plea filed, Negotiation 2 -> 1");
  check(pleaded.secondRefused, "a second plea in the same turn is refused");
  check(Math.abs(pleaded.paid - control.paid / 2) <= 1, "rent halved: $" + control.paid + " -> $" + pleaded.paid);
  check(pleaded.afterRollRefused, "pleading after the roll is refused");
  check(pleaded.halvedBadge, "the plea is marked on the player for this turn");
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
