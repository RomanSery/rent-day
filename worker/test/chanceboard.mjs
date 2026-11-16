// Verifies the delayed server event path (Durable Object alarm): in dev mode
// Board-reading Chance cards: Robin Hood moves money from the leader, and the
// Detour choice card waits for its player, blocks the turn, and settles on a pick.

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
const newGame = async (name, classA = "Banker", classB = "Governor") => {
  const a = new Client("a"), b = new Client("b");
  const s = suffix + name;
  let r = await a.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email: `qa${s}@t.com`, username: `qa${s}`.slice(0, 10), password: "pw-test-1", confirmPassword: "pw-test-1" });
  a.id = r.data.id;
  r = await b.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email: `qb${s}@t.com`, username: `qb${s}`.slice(0, 10), password: "pw-test-1", confirmPassword: "pw-test-1" });
  b.id = r.data.id;
  r = await a.post("createGame", { data: { gameName: "Board " + name, maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, useTimers: true }, context: {} });
  const gameId = r.data.gameId;
  await a.connect(gameId); await b.connect(gameId);
  await a.post("joinGame", { gameId, piece: "Car", playerClass: classA });
  await b.post("joinGame", { gameId, piece: "Dog", playerClass: classB });
  const game = (await a.post("getGame", { gameId })).data.game;
  const cur = game.nextPlayerToAct === a.id ? a : b;
  const other = cur === a ? b : a;
  return { a, b, gameId, cur, other, game };
};
const getGame = async (c, gameId) => (await c.post("getGame", { gameId })).data.game;
const money = (game, id) => game.players.find((p) => p._id === id).money;

// --- Detour, walking ---------------------------------------------------------
{
  const { a, b, gameId, cur } = await newGame("w");
  let r = await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 31 });
  check(r.status === 200, "roll onto Chance with Detour forced -> " + r.status);
  let game = await getGame(a, gameId);
  const before = money(game, cur.id);
  check(game.pendingChance && game.pendingChance.chanceId === 31 && game.pendingChance.playerId === cur.id, "pending choice stored for the roller");
  check(game.pendingChance?.choices?.map((o) => o.key).join(",") === "pay,walk", "options: " + JSON.stringify(game.pendingChance?.choices));
  check(/Sheepshead/i.test(game.pendingChance?.subLine ?? ""), "card names the nearest unowned square: " + game.pendingChance?.subLine);

  r = await cur.post("actions/roll", { context: { gameId }, forceDie1: 2, forceDie2: 3 });
  check(r.status !== 200 && /Word on the Street card/.test(JSON.stringify(r.data)), "rolling again (after the double) is blocked: " + JSON.stringify(r.data));
  r = await cur.post("actions/completeTurn", { context: { gameId } });
  check(r.status !== 200, "ending the turn is blocked while choosing -> " + r.status);
  const nonRoller = cur === a ? b : a;
  r = await nonRoller.post("actions/chanceChoice", { context: { gameId }, choice: "pay" });
  check(r.status !== 200, "the other player can't choose -> " + r.status);
  r = await cur.post("actions/chanceChoice", { context: { gameId }, choice: "bogus" });
  check(r.status !== 200, "an unknown option is refused -> " + r.status);

  r = await cur.post("actions/chanceChoice", { context: { gameId }, choice: "walk" });
  check(r.status === 200 && r.data.needToAnimate === true && r.data.frames.at(-1) === 4, "walk -> frames end on square 4: " + JSON.stringify(r.data));
  game = await getGame(a, gameId);
  const me = game.players.find((p) => p._id === cur.id);
  check(!game.pendingChance, "pending choice cleared");
  check(me.position === 4 && me.money === before, "piece on square 4, money unchanged");
  check(game.auctionId && game.auctionSquareId === 4, "square 4 goes up for auction");
  check(/Walked to/.test(game.log.at(-1)?.msg ?? ""), "log says what was picked: " + game.log.at(-1)?.msg);
  r = await cur.post("actions/chanceChoice", { context: { gameId }, choice: "pay" });
  check(r.status !== 200, "can't choose twice -> " + r.status);
  a.ws.close(); b.ws.close();
}

// --- Detour, paying ----------------------------------------------------------
{
  const { a, b, gameId, cur } = await newGame("p");
  await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 31 });
  let game = await getGame(a, gameId);
  const before = money(game, cur.id);
  const r = await cur.post("actions/chanceChoice", { context: { gameId }, choice: "pay" });
  check(r.status === 200 && r.data.needToAnimate === false, "pay -> no movement");
  game = await getGame(a, gameId);
  check(money(game, cur.id) === before - 100 && game.players.find((p) => p._id === cur.id).position === 3, "paid $100 and stayed on Chance");
  check(!game.pendingChance && !game.auctionId, "nothing pending, no auction");
  a.ws.close(); b.ws.close();
}

// --- Detour, out of time -----------------------------------------------------
{
  const { a, b, gameId, cur } = await newGame("t");
  // a 1+2 roll is not a double, so the turn can end once the card is settled
  await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 31 });
  let game = await getGame(a, gameId);
  const before = money(game, cur.id);
  const waitMs = new Date(game.nextPlayerActBy).getTime() - Date.now();
  if (waitMs < 95000) {
    await sleep(Math.max(0, waitMs) + 1500);
    const r = await a.post("actions/timesUpAction", { context: { gameId } });
    check(r.status === 200, "timesUpAction -> " + r.status);
    game = await getGame(a, gameId);
    // after the double the timer rolls again for the player, so money can move on from there
    check(!game.pendingChance, "timeout cleared the card");
    check(game.log.some((m) => /Paid \$100 for a cab/.test(m.msg)), "timeout took the default (pay): " + game.log.map((m) => m.msg).join(" | "));
  } else {
    console.log("    (turn timer is " + Math.round(waitMs / 1000) + "s; timeout check skipped)");
  }
  a.ws.close(); b.ws.close();
}

// --- Robin Hood --------------------------------------------------------------
{
  const { a, b, gameId, cur } = await newGame("r");
  let game = await getGame(a, gameId);
  // everyone starts level, so seat order picks the leader
  const top = game.players[0], rest = game.players[1];
  const tb = top.money, rb = rest.money;
  const r = await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 29 });
  check(r.status === 200, "roll onto Chance with Robin Hood forced -> " + r.status);
  game = await getGame(a, gameId);
  check(money(game, top._id) === tb - 50 && money(game, rest._id) === rb + 50, "leader paid $50 to the other player: " + tb + "->" + money(game, top._id) + ", " + rb + "->" + money(game, rest._id));
  check(!game.pendingChance, "no choice on this card");
  await sleep(6000);
  const ev = cur.events.filter((e) => e.event === "showChanceEvent").at(-1)?.args?.[0]?.[0];
  check(ev && ev.chanceId === 29 && ev.subLine.includes(top.name + " pays $50"), "card names who pays: " + ev?.subLine);
  check(ev && ev.isGood === (cur.id !== top._id), "tone follows whether the drawer leads: isGood=" + ev?.isGood);
  check(ev && !ev.choices, "no choices sent");
  a.ws.close(); b.ws.close();
}

// --- cards that read the drawer's skills -------------------------------------
const skillUp = async (c, gameId, skillType, times) => {
  for (let i = 0; i < times; i++) {
    const r = await c.post("actions/upgradeSkill", { context: { gameId }, skillType });
    if (r.status !== 200) throw new Error("upgradeSkill failed: " + JSON.stringify(r.data));
  }
};
const me = (game, id) => game.players.find((p) => p._id === id);
/** the card as the table saw it (sent a few seconds after the roll) */
const cardShown = async (c, chanceId) => {
  for (let i = 0; i < 40; i++) {
    const ev = c.events.filter((e) => e.event === "showChanceEvent").map((e) => e.args?.[0]?.[0]).find((e) => e?.chanceId === chanceId);
    if (ev) return ev;
    await sleep(250);
  }
  return undefined;
};

// Lucky subway musician: $20 x a die roll + $20 per Luck point
{
  const { a, b, gameId, cur } = await newGame("m");
  await skillUp(cur, gameId, "Luck", 3);
  let game = await getGame(a, gameId);
  const before = money(game, cur.id);
  const r = await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 32 });
  check(r.status === 200, "roll onto Chance with the subway musician forced -> " + r.status);
  game = await getGame(a, gameId);
  const gain = money(game, cur.id) - before;
  const tipsFromDie = gain - 60;
  check(tipsFromDie % 20 === 0 && tipsFromDie >= 20 && tipsFromDie <= 120, "musician pays $20 x a die (1-6) + $60 for Luck 3: +" + gain);
  const ev = await cardShown(cur, 32);
  check(ev && ev.isGood && ev.subLine.includes("rolled a " + tipsFromDie / 20 + ": $" + gain), "card shows the roll and what it paid: " + ev?.subLine);
  a.ws.close(); b.ws.close();
}

// Flea market haggle: $25 + $15 per Negotiation point
{
  const { a, b, gameId, cur } = await newGame("h");
  await skillUp(cur, gameId, "Negotiation", 2);
  let game = await getGame(a, gameId);
  const before = money(game, cur.id);
  await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 33 });
  game = await getGame(a, gameId);
  check(money(game, cur.id) === before + 55, "haggle pays $25 + $30 for Negotiation 2: " + before + " -> " + money(game, cur.id));
  a.ws.close(); b.ws.close();
}

// Building inspector: $150, $25 less per Corruption point, never below $0
{
  const { a, b, gameId, cur } = await newGame("i");
  let game = await getGame(a, gameId);
  let before = money(game, cur.id);
  await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 10 });
  game = await getGame(a, gameId);
  check(money(game, cur.id) === before - 150, "no Corruption: the full $150 fine: " + before + " -> " + money(game, cur.id));
  const ev = await cardShown(cur, 10);
  check(ev && ev.isGood === false && ev.subLine.includes("$150"), "card shows the fine as bad news: " + ev?.subLine);
  a.ws.close(); b.ws.close();
}
{
  const { a, b, gameId, cur } = await newGame("j");
  await skillUp(cur, gameId, "Corruption", 5);
  let game = await getGame(a, gameId);
  const before = money(game, cur.id);
  await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 10 });
  game = await getGame(a, gameId);
  check(money(game, cur.id) === before - 25, "Corruption 5: the fine drops to $25: " + before + " -> " + money(game, cur.id));
  a.ws.close(); b.ws.close();
}

// Night class: a choice card that moves one skill point
{
  const { a, b, gameId, cur } = await newGame("n");
  await skillUp(cur, gameId, "Negotiation", 3);
  await skillUp(cur, gameId, "Corruption", 1);
  let r = await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 34 });
  check(r.status === 200, "roll onto Chance with Night class forced -> " + r.status);
  let game = await getGame(a, gameId);
  const keys = game.pendingChance?.choices?.map((o) => o.key) ?? [];
  const labels = game.pendingChance?.choices?.map((o) => o.label) ?? [];
  check(game.pendingChance?.chanceId === 34 && keys[0] === "keep", "pending choice, keeping first (the timeout default): " + JSON.stringify(labels));
  check(labels.includes("Negotiation → Luck") && labels.includes("Negotiation → Corruption") && labels.includes("Corruption → Negotiation"),
    "each skill can take a point from the strongest other one: " + JSON.stringify(labels));
  const p0 = me(game, cur.id);
  r = await cur.post("actions/chanceChoice", { context: { gameId }, choice: "to:Luck" });
  check(r.status === 200, "pick Negotiation -> Luck -> " + r.status);
  game = await getGame(a, gameId);
  const p1 = me(game, cur.id);
  check(p1.luck === p0.luck + 1 && p1.negotiation === p0.negotiation - 1 && p1.corruption === p0.corruption,
    `one point moved: luck ${p0.luck}->${p1.luck}, negotiation ${p0.negotiation}->${p1.negotiation}`);
  check(!game.pendingChance && /Moved a point from Negotiation to Luck/.test(game.log.at(-1)?.msg ?? ""), "card settled and logged: " + game.log.at(-1)?.msg);
  a.ws.close(); b.ws.close();
}
{
  const { a, b, gameId, cur } = await newGame("k");
  await skillUp(cur, gameId, "Luck", 1);
  await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 34 });
  let game = await getGame(a, gameId);
  const p0 = me(game, cur.id);
  const r = await cur.post("actions/chanceChoice", { context: { gameId }, choice: "keep" });
  game = await getGame(a, gameId);
  const p1 = me(game, cur.id);
  check(r.status === 200 && p1.luck === p0.luck && p1.negotiation === p0.negotiation && p1.corruption === p0.corruption, "keeping changes nothing");
  a.ws.close(); b.ws.close();
}

// --- government cards ---------------------------------------------------------

// Vaccine passport check: pay $75, or go to quarantine
{
  const { a, b, gameId, cur } = await newGame("v");
  let game = await getGame(a, gameId);
  const before = money(game, cur.id);
  let r = await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 5 });
  check(r.status === 200, "roll onto Chance with the vaccine passport check forced -> " + r.status);
  game = await getGame(a, gameId);
  check(game.pendingChance?.chanceId === 5 && game.pendingChance.choices.map((o) => o.key).join(",") === "pay,quarantine",
    "choice of paying (first, the timeout default) or quarantine: " + JSON.stringify(game.pendingChance?.choices));
  r = await cur.post("actions/chanceChoice", { context: { gameId }, choice: "quarantine" });
  check(r.status === 200, "refuse -> " + r.status);
  game = await getGame(a, gameId);
  const p = me(game, cur.id);
  check(p.state === "In_Isolation" && p.position === 11, `sent to quarantine: ${p.state} on ${p.position}`);
  check(p.money === before, "no fee and no payday on the way: " + before + " -> " + p.money);
  check(p.hasRolled === true, "the double's extra roll is gone");
  r = await cur.post("actions/roll", { context: { gameId }, forceDie1: 2, forceDie2: 3 });
  check(r.status !== 200, "can't roll again after being sent to quarantine -> " + r.status);
  r = await cur.post("actions/completeTurn", { context: { gameId } });
  check(r.status === 200, "the turn can end -> " + r.status + " " + JSON.stringify(r.data));
  check(/Refused the vaccine passport check/.test(game.log.at(-1)?.msg ?? ""), "logged: " + game.log.at(-1)?.msg);
  a.ws.close(); b.ws.close();
}
{
  const { a, b, gameId, cur } = await newGame("x");
  let game = await getGame(a, gameId);
  const before = money(game, cur.id);
  await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 5 });
  const r = await cur.post("actions/chanceChoice", { context: { gameId }, choice: "pay" });
  game = await getGame(a, gameId);
  const p = me(game, cur.id);
  check(r.status === 200 && p.money === before - 75 && p.state !== "In_Isolation" && p.position === 3, "pay: $75 and stay put on the square");
  a.ws.close(); b.ws.close();
}

// Essential worker: $100 hazard pay, $200 for a Conductor
{
  const { a, b, gameId, cur } = await newGame("e", "Conductor", "Conductor");
  let game = await getGame(a, gameId);
  const before = money(game, cur.id);
  await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 20 });
  game = await getGame(a, gameId);
  check(money(game, cur.id) === before + 200, "a Conductor collects $200: " + before + " -> " + money(game, cur.id));
  a.ws.close(); b.ws.close();
}
{
  const { a, b, gameId, cur } = await newGame("f", "Banker", "Banker");
  let game = await getGame(a, gameId);
  const before = money(game, cur.id);
  await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 20 });
  game = await getGame(a, gameId);
  check(money(game, cur.id) === before + 100, "anyone else collects $100: " + before + " -> " + money(game, cur.id));
  a.ws.close(); b.ws.close();
}

// Re-education seminar: Negotiation -1, Corruption +1
{
  const { a, b, gameId, cur } = await newGame("r2");
  await skillUp(cur, gameId, "Negotiation", 2);
  let game = await getGame(a, gameId);
  const p0 = me(game, cur.id);
  await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 23 });
  game = await getGame(a, gameId);
  const p1 = me(game, cur.id);
  check(p1.negotiation === p0.negotiation - 1 && p1.corruption === p0.corruption + 1,
    `negotiation ${p0.negotiation}->${p1.negotiation}, corruption ${p0.corruption}->${p1.corruption}`);
  const ev = await cardShown(cur, 23);
  check(ev && ev.isGood === false, "bad news when there was Negotiation to lose");
  a.ws.close(); b.ws.close();
}
{
  const { a, b, gameId, cur } = await newGame("r3");
  let game = await getGame(a, gameId);
  const p0 = me(game, cur.id);
  await cur.post("actions/roll", { context: { gameId }, forceDie1: 1, forceDie2: 1, forceChanceId: 23 });
  game = await getGame(a, gameId);
  const p1 = me(game, cur.id);
  check(p0.negotiation === 0 && p1.negotiation === 0 && p1.corruption === p0.corruption + 1, "no Negotiation to lose: just Corruption +1");
  const ev = await cardShown(cur, 23);
  check(ev && ev.isGood === true && /no Negotiation to lose/.test(ev.subLine), "good news then, and the card says why: " + ev?.subLine);
  a.ws.close(); b.ws.close();
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
