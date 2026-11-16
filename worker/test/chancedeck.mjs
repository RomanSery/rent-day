// Word on the Street (Chance) cards come from a shuffled deck: every card is
// drawn once before any repeats, and the deck never reaches players.
// Watches a bots-only simulation and records every card drawn. Run the
// Worker with fast bots:
//
//   npx wrangler dev --var DEV_BOT_PACE_MS:30
//   npm run test:api:chancedeck

const BASE = process.env.BASE || "http://localhost:8787";
const WS_BASE = BASE.replace(/^http/, "ws");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (cond, msg) => {
  console.log((cond ? "  ok   " : "  FAIL ") + msg);
  if (!cond) failures++;
};

let cookie = "";
const post = async (path, body) => {
  const r = await fetch(BASE + "/api/" + path, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body ?? {}),
  });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  if (sc.length) cookie = sc.map((s) => s.split(";")[0]).join("; ");
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; } catch { return { status: r.status, data: text }; }
};

/** cards every player can always draw (the rest depend on the board) */
const ALWAYS_AVAILABLE = 16;
const WANTED_DRAWS = 30;

const u = "cd" + Date.now().toString(36).slice(-6);
let r = await post("createAccount", { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email: `${u}@t.com`, username: u, password: "pw-test-1", confirmPassword: "pw-test-1" });
if (r.status !== 200) throw new Error("createAccount failed: " + JSON.stringify(r.data));

console.log("a bots-only game, watched");
// rich bots, so the game lasts long enough to go through the deck
r = await post("dev/simulate", { levels: ["Normal", "Normal", "Normal", "Normal"], initialMoney: 30000 });
check(r.status === 200, "simulation started -> " + r.status);
const gameId = r.data.gameId;

const draws = [];
const ws = new WebSocket(WS_BASE + "/ws?gameId=" + gameId + "&watch=1", { headers: { cookie } });
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", () => reject(new Error("watch socket refused")));
});
ws.addEventListener("message", (ev) => {
  try {
    const msg = JSON.parse(ev.data);
    if (msg.event === "showChanceEvent") {
      draws.push(msg.args[0][0].chanceId);
    }
  } catch {}
});

const start = Date.now();
let game = null;
while (Date.now() - start < 240000 && draws.length < WANTED_DRAWS) {
  await sleep(1000);
  game = (await post("dev/game", { gameId })).data.game;
  if (!game || game.status !== "Active") break;
}
ws.close();
console.log("  cards drawn: " + draws.join(" "));
console.log(`  game: ${game?.status ?? "gone"}, turn ${game?.turnNumber}, ${Math.round((Date.now() - start) / 1000)} s`);

console.log("the deck");
check(draws.length >= ALWAYS_AVAILABLE, `enough cards drawn to judge (${draws.length})`);
const first = draws.slice(0, ALWAYS_AVAILABLE);
check(new Set(first).size === first.length, `no repeats in the first ${first.length} draws`);
const backToBack = draws.findIndex((id, i) => i > 0 && draws[i - 1] === id);
check(backToBack < 0, "never the same card twice in a row" + (backToBack < 0 ? "" : " (draw " + backToBack + ")"));
// with a deck, every run of 20 draws holds at least 10 different cards;
// drawing with replacement would often repeat sooner
for (let i = 0; i + 20 <= draws.length; i += 5) {
  const run = new Set(draws.slice(i, i + 20)).size;
  if (run < 10) {
    check(false, `draws ${i}-${i + 19} hold only ${run} different cards`);
  }
}

console.log("the deck stays secret");
game = (await post("dev/game", { gameId })).data.game;
check(game && !("chanceDeck" in game) && !("lastChanceId" in game), "the game sent out has no deck in it");

console.log(failures === 0 ? "\nall chance deck checks passed" : `\n${failures} chance deck check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
