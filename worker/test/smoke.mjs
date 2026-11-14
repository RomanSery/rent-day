// Two-player smoke test against a running Worker (default: wrangler dev on :8787).
// Run with:  npm run test:api   (or BASE=http://... node test/smoke.mjs)
// Exercises accounts, sessions, lobby, join, WebSocket broadcasts, rolling,
// auctions, lotto, chat, trades, skills and resigning.

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
    this.id = null;
    this.events = [];
    this.ws = null;
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

  connect(gameId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_BASE + "/ws?gameId=" + gameId, {
        headers: { cookie: this.cookie },
      });
      ws.addEventListener("open", () => resolve(ws));
      ws.addEventListener("error", (e) => reject(e.error || new Error("ws error")));
      ws.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          this.events.push(msg);
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

  clearEvents() {
    this.events = [];
  }
}

const suffix = Date.now().toString(36).slice(-5);
const alice = new Client("alice");
const bob = new Client("bob");
const pw = "pw-test-1234";

console.log("== accounts");
let r = await alice.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
  email: `alice${suffix}@test.com`,
  username: `al${suffix}`,
  password: pw,
  confirmPassword: pw,
});
check(r.status === 200 && r.data.id, "alice createAccount -> " + r.status);
alice.id = r.data.id;

r = await bob.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
  email: `bob${suffix}@test.com`,
  username: `bo${suffix}`,
  password: pw,
  confirmPassword: pw,
});
check(r.status === 200 && r.data.id, "bob createAccount -> " + r.status);
bob.id = r.data.id;

r = await alice.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
  email: `alice${suffix}@test.com`,
  username: `zz${suffix}`,
  password: pw,
  confirmPassword: pw,
});
check(r.status === 403, "duplicate email rejected -> " + r.status);

r = await alice.post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
  email: "not-an-email",
  username: `zz${suffix}`,
  password: pw,
  confirmPassword: pw,
});
check(r.status === 400 && r.data.errors?.[0]?.msg, "validation error shape -> " + JSON.stringify(r.data));

console.log("== sessions");
r = await alice.post("logout");
check(r.status === 200, "logout -> " + r.status);
r = await alice.post("current-session");
check(r.status === 401, "current-session after logout -> " + r.status);
r = await alice.post("logIn", { username: `alice${suffix}@test.com`, password: "wrong" });
check(r.status === 400, "bad password rejected -> " + r.status);
r = await alice.post("logIn", { username: `alice${suffix}@test.com`, password: pw });
check(r.status === 200 && r.data.id === alice.id, "login -> " + r.status);
r = await alice.post("current-session");
check(r.status === 200 && r.data.userName === `al${suffix}`, "current-session -> " + JSON.stringify(r.data));
r = await new Client("anon").post("findGames");
check(r.status === 400, "unauthenticated findGames rejected -> " + r.status);

console.log("== lobby");
r = await alice.post("createGame", {
  data: { gameName: "Smoke <game>", maxPlayers: 2, initialMoney: 1500, initialSkillPoints: 5, useTimers: false },
  context: { gameId: null },
});
check(r.status === 200 && /^[0-9a-f]{24}$/.test(r.data.gameId), "createGame -> " + JSON.stringify(r.data));
const gameId = r.data.gameId;

r = await bob.post("findGames");
check(r.data.games?.some((g) => g.gameId === gameId && g.playersJoined === 0), "findGames lists new game");

r = await bob.post("getGame", { gameId });
check(r.data.game?.status === "Joining" && r.data.game.name === "Smoke &lt;game&gt;", "getGame joining, name escaped");

console.log("== websockets + join");
await alice.connect(gameId);
await bob.connect(gameId);
await sleep(200);

r = await alice.post("joinGame", { gameId, piece: "Car", playerClass: "Banker" });
check(r.status === 200 && r.data.allJoined === false && r.data.playerName === `al${suffix}`, "alice joinGame -> " + JSON.stringify(r.data));
alice.send("joinedGame", { playerName: r.data.playerName, userId: alice.id, gameId, allJoined: false });
await sleep(300);
check(bob.received("joinedGame").length === 1, "bob received joinedGame broadcast");
check(alice.received("joinedGame").length === 0, "alice did not receive her own joinedGame");

r = await alice.post("joinGame", { gameId, piece: "Car", playerClass: "Banker" });
check(r.status === 400, "double join rejected -> " + r.status + " " + r.data);

r = await bob.post("joinGame", { gameId, piece: "Cat", playerClass: "Gambler" });
check(r.status === 200 && r.data.allJoined === true, "bob joinGame completes lobby -> " + JSON.stringify(r.data));

r = await bob.post("findGames");
check(!r.data.games?.some((g) => g.gameId === gameId), "active game no longer listed in lobby");

r = await alice.post("current-session");
check(r.data.currGameId === gameId, "current-session reports current game");

let game = (await alice.post("getGame", { gameId })).data.game;
check(game.status === "Active" && game.players.length === 2, "game active with 2 players");
check(game.settings.password === null, "password field not leaked");

const byId = (id) => (id === alice.id ? alice : bob);

console.log("== play turns");
for (let turn = 0; turn < 10 && game.status === "Active"; turn++) {
  const cur = byId(game.nextPlayerToAct);
  const other = cur === alice ? bob : alice;
  cur.clearEvents();
  other.clearEvents();

  let rolls = 0;
  while (true) {
    r = await cur.post("actions/roll", { context: { gameId } });
    if (r.status !== 200) {
      console.log("    roll rejected: " + r.data);
      break;
    }
    rolls++;
    check(r.data.diceRoll && typeof r.data.diceRoll.die1 === "number", `turn ${turn} ${cur.name} rolled ${r.data.diceRoll?.die1},${r.data.diceRoll?.die2}`);
    cur.send("stopAnimateDice", gameId, r.data.playerId, r.data.diceRoll, r.data.frames);
    cur.send("updateGameState", gameId);
    await sleep(300);
    game = (await cur.post("getGame", { gameId })).data.game;

    if (game.auctionId) {
      console.log("    auction on square " + game.auctionSquareId);
      const done = await cur.post("actions/completeTurn", { context: { gameId } });
      check(done.status === 400, "completeTurn blocked while auction is open -> " + done.status);
      const a1 = await alice.post("actions/bid", { bid: 0, context: { gameId } });
      const again = await alice.post("actions/bid", { bid: 500, context: { gameId } });
      check(again.status === 400, "second bid after bidding 0 rejected -> " + again.status);
      const a2 = await bob.post("actions/bid", { bid: 35, context: { gameId } });
      check(a1.status === 200 && a2.status === 200, "both bids accepted");
      alice.send("auctionBid", gameId, game.auctionId);
      await sleep(300);
      const au = (await alice.post("getAuction", { auctionId: game.auctionId, context: { gameId } })).data.auction;
      check(au.finished && au.winnerId === bob.id, "auction finished, bob won");
      game = (await cur.post("getGame", { gameId })).data.game;
      check(game.auctionId === null, "auction cleared from game");
      const result = game.lastAuction;
      check(result && result.auctionId === au._id && result.winnerId === bob.id, "game keeps the auction result for every screen");
      const bobNow = game.players.find((p) => p._id === bob.id);
      check(bobNow.stats && bobNow.stats.auctionsWon >= 1, "bob's auction wins are counted (" + (bobNow.stats?.auctionsWon ?? "none") + ")");
      // alice bid $0, so bob pays the second-highest bid: $0
      check(result && result.price === 0 && result.bids.length === 2 &&
        result.bids[0].playerId === bob.id && result.bids[0].bid === 35 && result.bids[1].bid === 0,
        "result has the price paid and every bid, highest first");
    }

    if (game.pendingChance?.playerId === cur.id) {
      console.log("    chance choice");
      const c = await cur.post("actions/chanceChoice", { choice: game.pendingChance.choices[0].key, context: { gameId } });
      check(c.status === 200, "chance choice accepted");
      game = (await cur.post("getGame", { gameId })).data.game;
    }

    if (game.lottoId) {
      console.log("    lotto");
      const l = await cur.post("actions/pickLotto", { opt: 1, context: { gameId } });
      check(l.status === 200, "lotto pick accepted");
      cur.send("lottoUpdate", gameId, game.lottoId);
      await sleep(200);
      game = (await cur.post("getGame", { gameId })).data.game;
    }

    const me = game.players.find((p) => p._id === cur.id);
    if (game.status !== "Active" || me.hasRolled || me.state === "Bankrupt") {
      break;
    }
    console.log("    rolled a double, rolling again");
  }

  if (game.status !== "Active") break;

  if (game.lottoId) {
    const l = await cur.post("actions/pickLotto", { opt: 2, context: { gameId } });
    check(l.status === 200, "pending lotto picked");
    game = (await cur.post("getGame", { gameId })).data.game;
  }

  console.log("    " + other.name + " saw: " + other.events.map((e) => e.event).join(", "));
  const me = game.players.find((p) => p._id === cur.id);
  if (me.state === "Bankrupt") {
    console.log("    " + cur.name + " went bankrupt");
    continue;
  }

  if (me.money < 0) {
    console.log("    negative money; skipping completeTurn");
    break;
  }

  r = await cur.post("actions/completeTurn", { context: { gameId } });
  check(r.status === 200, `turn ${turn} ${cur.name} completeTurn -> ${r.status} ${r.status !== 200 ? r.data : ""}`);
  cur.send("updateGameState", gameId, true);
  await sleep(300);

  check(other.received("updateGameState").length >= 1, "other player received updateGameState");
  check(other.received("stopAnimateDice").length >= 1, "other player received stopAnimateDice");
  const sound = other.received("playSoundEffect");
  check(sound.length === 1 && sound[0].args[0][0].playerId === other.id, "next player got YourTurn sound (wrapped in array)");

  game = (await cur.post("getGame", { gameId })).data.game;
  check(game.nextPlayerToAct === other.id, "turn passed to " + other.name);
}

console.log("== chat");
bob.clearEvents();
alice.send("sendChatMsg", gameId, { msg: "hi <b>bob</b>", player: `al${suffix}` });
await sleep(300);
const chat = bob.received("newChatMsg");
check(chat.length === 1 && chat[0].args[0].msg === "hi &lt;b&gt;bob&lt;/b&gt;", "chat broadcast with tags escaped: " + JSON.stringify(chat[0]?.args));
game = (await alice.post("getGame", { gameId })).data.game;
check(game.messages.length === 1, "chat message persisted");

console.log("== trade");
if (game.status === "Active") {
  r = await alice.post("actions/offerTrade", {
    context: { gameId }, tradingWithPlayerId: bob.id, mines: [], theirs: [], myAmount: 10, theirAmount: 5,
  });
  check(r.status === 200 && r.data.newTradeId, "offerTrade -> " + JSON.stringify(r.data));
  bob.clearEvents();
  alice.send("sendTradeOffer", r.data.newTradeId);
  await sleep(300);
  check(bob.received("sendTradeOffer").length === 1, "bob received trade offer");
  const before = (await alice.post("getGame", { gameId })).data.game;
  const bobBefore = before.players.find((p) => p._id === bob.id).money;
  const acc = await bob.post("actions/acceptTrade", { context: { gameId }, tradeId: r.data.newTradeId });
  check(acc.status === 200, "acceptTrade -> " + acc.status + " " + (acc.status !== 200 ? acc.data : ""));
  const after = (await alice.post("getGame", { gameId })).data.game;
  check(after.players.find((p) => p._id === bob.id).money === bobBefore + 5, "trade moved money");
  const again = await bob.post("actions/acceptTrade", { context: { gameId }, tradeId: r.data.newTradeId });
  check(again.status === 400, "accepting twice rejected");
}

console.log("== skills");
game = (await alice.post("getGame", { gameId })).data.game;
if (game.status === "Active") {
  const cur = byId(game.nextPlayerToAct);
  const other = cur === alice ? bob : alice;
  r = await other.post("actions/upgradeSkill", { context: { gameId }, skillType: "Luck" });
  check(r.status === 400, "upgradeSkill out of turn rejected");
  r = await cur.post("actions/upgradeSkill", { context: { gameId }, skillType: "Luck" });
  check(r.status === 200, "upgradeSkill in turn accepted");
}

console.log("== resign");
r = await bob.post("resignGame", { gameId });
check(r.status === 200, "bob resignGame -> " + r.status);
game = (await alice.post("getGame", { gameId })).data.game;
check(game.status === "Finished" && game.winner === `al${suffix}`, "game finished, alice wins");
r = await alice.post("current-session");
check(r.data.currGameId === null, "finished game cleared from current-session");
r = await bob.post("current-session");
check(r.data.currGameId === null, "resigned player no longer attached to the game");
r = await alice.post("findPlayers");
const aliceInfo = r.data.players.find((p) => p.playerId === alice.id);
const bobInfo = r.data.players.find((p) => p.playerId === bob.id);
check(aliceInfo?.wins === 1 && bobInfo?.wins === 0 && aliceInfo.gamesPlayed === 1, "findPlayers shows win/loss stats: " + JSON.stringify([aliceInfo, bobInfo]));
check(bobInfo?.losses === 1 && aliceInfo?.losses === 0, "one loss recorded for bob, none for alice");
check(aliceInfo?.currentStreak === 1 && aliceInfo.bestStreak === 1 && bobInfo?.currentStreak === 0,
  "win streaks: alice 1, bob 0");
check(aliceInfo?.bestWinWorth > 0 && !!aliceInfo.lastPlayedAt && !!bobInfo?.lastPlayedAt,
  "best win net worth and last played recorded");

console.log("== websocket close");
alice.clearEvents();
bob.ws.close(1000, "bye");
await sleep(400);
check(alice.received("showSnackMsg").some((e) => /disconnected/.test(e.args[0])), "disconnect snack broadcast");
alice.ws.close();

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
