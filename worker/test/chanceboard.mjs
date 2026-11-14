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
const newGame = async (name) => {
  const a = new Client("a"), b = new Client("b");
  const s = suffix + name;
  let r = await a.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email: `qa${s}@t.com`, username: `qa${s}`.slice(0, 10), password: "pw-test-1", confirmPassword: "pw-test-1" });
  a.id = r.data.id;
  r = await b.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email: `qb${s}@t.com`, username: `qb${s}`.slice(0, 10), password: "pw-test-1", confirmPassword: "pw-test-1" });
  b.id = r.data.id;
  r = await a.post("createGame", { data: { gameName: "Board " + name, maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, useTimers: true }, context: {} });
  const gameId = r.data.gameId;
  await a.connect(gameId); await b.connect(gameId);
  await a.post("joinGame", { gameId, piece: "Car", playerClass: "Banker" });
  await b.post("joinGame", { gameId, piece: "Dog", playerClass: "Governor" });
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
  check(r.status !== 200 && /Chance card/.test(JSON.stringify(r.data)), "rolling again (after the double) is blocked: " + JSON.stringify(r.data));
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

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
