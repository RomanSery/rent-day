// Measures what games cost in Cloudflare's billable units, using the
// development-only meters in src/dev/usage.ts. Not a pass/fail test.
//
// Scripted players behave like the real client: they announce rolls, refresh
// the state after every piece animation and auction, open the auction and
// lotto panels (which fetch them), bid, pick lotto prizes and end turns.
//
//   npx wrangler dev --var DEV_BOT_PACE_MS:0        # in worker/
//   npm run usage                                   # all scenarios
//   SCENARIOS=humans TURNS=80 npm run usage         # just one
//
// Scenarios: humans (4 humans), mixed (1 human + 3 bots), bots (4 bots, a
// whole game). Run them on a server nobody else is using: the Worker's
// meters are global.

const BASE = process.env.BASE || "http://localhost:8787";
const WS_BASE = BASE.replace(/^http/, "ws");
const TURNS = Number(process.env.TURNS || 60);
const SCENARIOS = (process.env.SCENARIOS || "humans,mixed,bots").split(",");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Player {
  constructor(name) {
    this.name = name;
    this.cookie = "";
    this.ws = null;
    this.state = null; // latest game state pushed to this player
    this.handledAuctions = new Set();
    this.ackedAuctions = new Set();
    this.lottosSeen = new Set();
    this.busy = Promise.resolve();
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

  send(event, ...args) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, args }));
    }
  }

  /** Queue work so one player's reactions run one at a time, like a browser tab. */
  later(fn) {
    this.busy = this.busy.then(fn).catch((e) => console.log("    " + this.name + ": " + e.message));
    return this.busy;
  }

  connect(gameId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_BASE + "/ws?gameId=" + gameId, { headers: { cookie: this.cookie } });
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", () => reject(new Error("socket refused")));
      ws.addEventListener("message", (ev) => this.onMessage(gameId, JSON.parse(ev.data)));
      this.ws = ws;
    });
  }

  setState(state) {
    this.state = state;
    this.stateAt = performance.now();
  }

  /** Every screen shows the lotto panel (it fetches the lotto); the roller picks. */
  openLotto(gameId, lottoId) {
    if (this.lottosSeen.has(lottoId)) return this.busy;
    this.lottosSeen.add(lottoId);
    const ctx = { context: { gameId } };
    return this.later(async () => {
      await this.post("getLotto", { lottoId, ...ctx });
      if (this.state?.nextPlayerToAct === this.id) {
        const r = await this.post("actions/pickLotto", { opt: 1 + Math.floor(Math.random() * 3), ...ctx });
        if (r.status === 200) {
          this.send("lottoUpdate", gameId, lottoId);
        }
      }
      await sleep(50);
      this.send("updateGameState", gameId); // AnimatedLottoResult
    });
  }

  /** The auction panel opens: it fetches the auction, then the player bids. */
  openAuction(gameId, auctionId) {
    if (this.handledAuctions.has(auctionId)) return this.busy;
    this.handledAuctions.add(auctionId);
    const ctx = { context: { gameId } };
    return this.later(async () => {
      const a = await this.post("getAuction", { auctionId, ...ctx });
      const mine = a.data?.auction?.bidders?.find((b) => b._id === this.id);
      if (!mine || mine.submittedBid || a.data.auction.finished) return;
      const money = this.state?.players?.find((p) => p._id === this.id)?.money ?? 0;
      const bid = Math.max(0, Math.min(money, Math.floor(Math.random() * 200)));
      const r = await this.post("actions/bid", { bid, ...ctx });
      if (r.status === 200) {
        this.send("auctionBid", gameId, auctionId);
      }
    });
  }

  onMessage(gameId, { event, args }) {
    const ctx = { context: { gameId } };
    if (event === "updateGameState" && args[0]) {
      this.setState(args[0]);
      if (this.state.auctionId) {
        this.openAuction(gameId, this.state.auctionId);
      }
      if (this.state.lottoId) {
        this.openLotto(gameId, this.state.lottoId);
      }
    }
    if (event === "stopAnimateDice") {
      const frames = args[2];
      if (Array.isArray(frames) && frames.length > 0) {
        // GamePieces: every screen refreshes once the piece has moved
        this.later(async () => this.send("updateGameState", gameId));
      }
    }
    if (event === "auctionUpdate" && args[0]) {
      const auction = args[0];
      if (auction.finished && !this.ackedAuctions.has(auction._id)) {
        this.ackedAuctions.add(auction._id);
        this.later(async () => this.send("updateGameState", gameId)); // CircleLoader
      }
    }
  }
}

let n = 0;
const suffix = Date.now().toString(36).slice(-4);
const signUp = async (label) => {
  const p = new Player(label);
  const u = `${label}${suffix}${n++}`.slice(0, 10);
  const r = await p.post("createAccount", { email: `${u}@t.com`, username: u, password: "pw-test-1", confirmPassword: "pw-test-1", remember: true });
  if (r.status !== 200) throw new Error("sign up failed: " + JSON.stringify(r.data));
  p.id = r.data.id;
  return p;
};

const usage = async (gameIds) => {
  const r = await fetch(BASE + "/api/dev/usage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gameIds }),
  });
  return r.json();
};
const resetUsage = (gameIds) =>
  fetch(BASE + "/api/dev/usage/reset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gameIds }),
  });

/** Billable totals from the meters; DO requests count WebSocket messages at 20:1. */
const summarize = (u, gameId) => {
  const room = u.rooms[gameId] ?? {};
  const doRequests = u.worker.rpcCalls + (room.wsConnects ?? 0) + (room.alarms ?? 0) + (room.wsMessages ?? 0) / 20;
  return {
    workerRequests: u.worker.requests,
    doRequests,
    rpcCalls: u.worker.rpcCalls,
    wsConnects: room.wsConnects ?? 0,
    wsMessages: room.wsMessages ?? 0,
    alarms: room.alarms ?? 0,
    doRowsRead: room.keysRead ?? 0,
    doRowsWritten: (room.keysWritten ?? 0) + (room.keysDeleted ?? 0),
    // setAlarm / deleteAlarm calls: kept apart, as they may not be billed as rows
    doAlarmSets: room.alarmWrites ?? 0,
    d1RowsRead: u.worker.d1.rowsRead + (room.d1?.rowsRead ?? 0),
    d1RowsWritten: u.worker.d1.rowsWritten + (room.d1?.rowsWritten ?? 0),
  };
};

const fmt = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
const printTable = (title, rows) => {
  console.log("\n" + title);
  const keys = Object.keys(rows[0][1]);
  console.log("  " + "".padEnd(16) + rows.map(([h]) => h.padStart(12)).join(""));
  for (const k of keys) {
    console.log("  " + k.padEnd(16) + rows.map(([, v]) => fmt(v[k]).padStart(12)).join(""));
  }
};

const perTurn = (totals, turns) => Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / Math.max(1, turns)]));

/**
 * Lobby and page loads: sign-up already happened; each human visits the
 * lobby list (loaded once), opens the join page, joins,
 * then the game page loads.
 */
const setUpGame = async (humans, numBots) => {
  const host = humans[0];
  let r = await host.post("createGame", {
    data: { gameName: "Usage", maxPlayers: humans.length + numBots, initialMoney: 1500, initialSkillPoints: 5, useTimers: false, numBots },
    context: {},
  });
  if (r.status !== 200) throw new Error("createGame failed: " + JSON.stringify(r.data));
  const gameId = r.data.gameId;
  await resetUsage([gameId]);

  for (const p of humans) {
    await p.post("current-session");
    await p.post("findGames", {}); // the lobby list loads once (no auto-refresh)
    await p.post("getGame", { gameId }); // join page
    await p.connect(gameId); // join page socket
    p.send("joinGameRoom", gameId, p.id, p.name);
  }
  const lobby = (await host.post("getGame", { gameId })).data.game;
  const freePieces = ["Pawn", "Hat", "Car", "Bicycle", "Cat", "Dog"].filter((x) => !lobby.players.some((pl) => pl.type === x || pl.piece === x));
  for (const p of humans) {
    r = await p.post("joinGame", { gameId, piece: freePieces[humans.indexOf(p)], playerClass: "Banker" });
    if (r.status !== 200) throw new Error("joinGame failed: " + JSON.stringify(r.data));
    p.send("joinedGame", { playerName: r.data.playerName, userId: p.id, gameId, allJoined: r.data.allJoined });
  }
  await sleep(300);
  // the game page: a fresh socket, the session check and the first state
  for (const p of humans) {
    p.ws.close();
    await p.post("current-session");
    await p.post("getGame", { gameId, ...{ context: { gameId } } }).then((x) => p.setState(x.data.game));
    await p.connect(gameId);
    p.send("joinGameRoom", gameId, p.id, p.name);
  }
  await sleep(300);
  return gameId;
};

/** Plays human turns like the client until `turns` turns have been completed. */
const playTurns = async (gameId, humans, turns) => {
  const ctx = { context: { gameId } };
  // the newest state any player has been sent
  const latest = () => humans.filter((p) => p.state).sort((a, b) => b.stateAt - a.stateAt)[0]?.state;
  let errors = 0;
  const resync = async (p) => {
    // a screen out of step with the server: what a reload would fetch
    const r = await p.post("getGame", { gameId, ...ctx });
    if (r.data?.game) p.setState(r.data.game);
  };
  const start = latest()?.turnNumber ?? 0;
  const deadline = Date.now() + 10 * 60 * 1000;
  let rollsThisTurn = 0;
  let lastTurn = -1;
  // real players wait for the screen to update before the next click
  const waitForNewState = async (before) => {
    for (let i = 0; i < 40 && latest() === before; i++) await sleep(50);
  };

  while (Date.now() < deadline) {
    await sleep(60);
    await Promise.all(humans.map((p) => p.busy));
    const g = latest();
    if (!g || g.status !== "Active" || (g.turnNumber ?? 0) - start >= turns) break;
    if (g.auctionId) {
      // everyone's panel shows the auction, even if their own update was late
      await Promise.all(humans.map((p) => p.openAuction(gameId, g.auctionId)));
      continue;
    }
    const cur = humans.find((p) => p.id === g.nextPlayerToAct);
    if (!cur) continue; // a bot's turn
    if (g.lottoId) {
      await cur.openLotto(gameId, g.lottoId);
      await waitForNewState(g);
      continue;
    }
    if (errors >= 6) {
      console.log("    giving up: the script and the game are out of step");
      break;
    }
    if ((g.turnNumber ?? 0) !== lastTurn) {
      lastTurn = g.turnNumber ?? 0;
      rollsThisTurn = 0;
    }
    const me = g.players.find((p) => p._id === cur.id);

    if (!me.hasRolled && rollsThisTurn < 4) {
      rollsThisTurn++;
      cur.send("rollDice", gameId);
      const r = await cur.post("actions/roll", ctx);
      if (r.status === 200) {
        errors = 0;
        cur.send(r.data.needToAnimate ? "stopAnimateDice" : "updateGameState", gameId);
        await waitForNewState(g);
      } else {
        errors++;
        await resync(cur);
        if (!/auction|lotto|turn/i.test(String(r.data))) rollsThisTurn = 99; // in debt, say: end the turn
      }
      continue;
    }
    const r = await cur.post("actions/completeTurn", ctx);
    if (r.status === 200) {
      errors = 0;
      cur.send("updateGameState", gameId, true);
      await waitForNewState(g);
    } else if (/not your turn|auction|lotto|roll/i.test(String(r.data))) {
      errors++;
      await resync(cur); // acted on a stale screen
    } else {
      console.log("    " + cur.name + " can't end the turn: " + r.data);
      return (latest()?.turnNumber ?? 0) - start;
    }
  }
  await sleep(500);
  const g = latest();
  return (g?.turnNumber ?? 0) - start;
};

const results = [];

if (SCENARIOS.includes("humans")) {
  console.log(`== 4 humans, ${TURNS} turns`);
  const humans = [];
  for (const l of ["ha", "hb", "hc", "hd"]) humans.push(await signUp(l));
  const gameId = await setUpGame(humans, 0);
  const setup = summarize(await usage([gameId]), gameId);
  await resetUsage([gameId]);
  const turns = await playTurns(gameId, humans, TURNS);
  const play = summarize(await usage([gameId]), gameId);
  for (const p of humans) p.ws?.close();
  console.log(`    played ${turns} turns`);
  results.push(["4 humans", setup, perTurn(play, turns), turns]);
}

if (SCENARIOS.includes("mixed")) {
  console.log(`== 1 human + 3 bots, ${TURNS} turns`);
  const human = await signUp("mx");
  const gameId = await setUpGame([human], 3);
  const setup = summarize(await usage([gameId]), gameId);
  await resetUsage([gameId]);
  const turns = await playTurns(gameId, [human], TURNS);
  const play = summarize(await usage([gameId]), gameId);
  human.ws?.close();
  console.log(`    played ${turns} turns`);
  results.push(["1h + 3 bots", setup, perTurn(play, turns), turns]);
}

if (SCENARIOS.includes("bots")) {
  console.log("== 4 bots, a whole game (no human clients)");
  const p = await signUp("bt");
  await resetUsage([]);
  let r = await p.post("dev/simulate", { levels: ["Normal", "Normal", "Normal", "Normal"] });
  const gameId = r.data.gameId;
  let g;
  let polls = 0;
  const deadline = Date.now() + 10 * 60 * 1000;
  do {
    await sleep(1000);
    polls++;
    g = (await p.post("dev/game", { gameId })).data.game;
  } while (g && g.status !== "Finished" && Date.now() < deadline);
  const play = summarize(await usage([gameId]), gameId);
  // the status polling above is the script's, not the game's
  play.workerRequests -= polls;
  play.doRequests -= polls;
  play.rpcCalls -= polls;
  const turns = g?.turnNumber ?? 0;
  console.log(`    game ${g?.status} after ${turns} turns`);
  results.push(["4 bots", null, perTurn(play, turns), turns]);
}

const setups = results.filter(([, s]) => s);
if (setups.length) {
  printTable("Getting into a game (whole lobby + page loads, all players)", setups.map(([h, s]) => [h, s]));
}
printTable("Per turn while playing", results.map(([h, , t]) => [h, t]));
console.log("\n" + JSON.stringify(results.map(([name, setup, turn, turns]) => ({ name, turns, setup, perTurn: turn }))));
process.exit(0);
