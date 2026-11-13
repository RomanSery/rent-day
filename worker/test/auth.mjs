// Auth checks: password rules, remember-me cookies, revocable sessions
// (log out, log out everywhere) and the per-email lockout.
//
//   npm run dev          # in worker/
//   npm run test:api:auth
//
// With the Worker started with `--var DEV_RATE_LIMIT:true`, set RATE_LIMIT=1
// to check only the per-IP login and sign-up limits (the other checks make
// enough requests to trip them).

const BASE = process.env.BASE || "http://localhost:8787";
const suffix = Date.now().toString(36).slice(-6);
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
  constructor() {
    this.cookie = "";
    this.lastSetCookie = "";
  }

  async post(path, body) {
    const r = await fetch(BASE + "/api/" + path, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: this.cookie },
      body: JSON.stringify(body ?? {}),
    });
    const setCookies = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    this.lastSetCookie = setCookies.join("\n");
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
    return { status: r.status, data, retryAfter: r.headers.get("retry-after") };
  }
}

const PW = "pw-test-1";
const account = (tag) => ({
  email: `${tag}${suffix}@t.com`,
  username: `${tag}${suffix}`.slice(0, 10),
  password: PW,
  confirmPassword: PW,
});

if (process.env.RATE_LIMIT) {
  console.log("per-IP limits");
  const c = new Client();
  let limited = false;
  for (let i = 0; i < 30 && !limited; i++) {
    const r = await c.post("logIn", { username: `ip${i}${suffix}@t.com`, password: "wrong-password" });
    limited = r.status === 429 && /network/.test(r.data);
  }
  check(limited, "many logins from one IP get limited");
  limited = false;
  for (let i = 0; i < 10 && !limited; i++) {
    const r = await c.post("createAccount", account("s" + i));
    limited = r.status === 429 && /network/.test(r.data);
  }
  check(limited, "many sign-ups from one IP get limited");
  console.log(failures ? `\n${failures} check(s) failed` : "\nall rate-limit checks passed");
  process.exit(failures ? 1 : 0);
}

console.log("password rules");
{
  const c = new Client();
  const r = await c.post("createAccount", { ...account("sh"), password: "short12", confirmPassword: "short12" });
  check(r.status === 400 && /at least 8/.test(r.data?.errors?.[0]?.msg), "7-character password rejected");
  const long = "x".repeat(129);
  const r2 = await c.post("createAccount", { ...account("lg"), password: long, confirmPassword: long });
  check(r2.status === 400, "129-character password rejected");
}

console.log("remember me");
const a = new Client();
const acctA = account("ra");
{
  let r = await a.post("createAccount", acctA);
  check(r.status === 200, "sign up without remember -> " + r.status);
  check(!/max-age/i.test(a.lastSetCookie), "no remember: browser-session cookie (no Max-Age)");
  check(/httponly/i.test(a.lastSetCookie) && /samesite=strict/i.test(a.lastSetCookie), "cookie is HttpOnly + SameSite=Strict");
  r = await a.post("current-session");
  check(r.status === 200 && r.data.userName === acctA.username, "session works");

  const b = new Client();
  r = await b.post("logIn", { username: acctA.email, password: PW, remember: true });
  check(r.status === 200, "log in with remember -> " + r.status);
  check(/max-age=2592000/i.test(b.lastSetCookie), "remember: 30-day persistent cookie");
}

console.log("log out revokes the token");
{
  const stolen = a.cookie;
  let r = await a.post("logout");
  check(r.status === 200, "log out");
  const thief = new Client();
  thief.cookie = stolen;
  r = await thief.post("current-session");
  check(r.status === 401, "old cookie no longer works -> " + r.status);
  r = await thief.post("findGames");
  check(r.status === 400, "old cookie rejected by API routes -> " + r.status);
}

console.log("log out everywhere");
{
  const phone = new Client();
  const laptop = new Client();
  await phone.post("logIn", { username: acctA.email, password: PW, remember: true });
  await laptop.post("logIn", { username: acctA.email, password: PW, remember: true });
  let r = await phone.post("current-session");
  check(r.status === 200, "phone signed in");
  r = await laptop.post("logoutAll");
  check(r.status === 200, "laptop logs out everywhere");
  r = await phone.post("current-session");
  check(r.status === 401, "phone session revoked -> " + r.status);
  r = await laptop.post("current-session");
  check(r.status === 401, "laptop session revoked -> " + r.status);
}

console.log("garbage cookies");
{
  const c = new Client();
  c.cookie = "rentday_session=not-a-token";
  check((await c.post("current-session")).status === 401, "malformed token -> 401");
  c.cookie = "rentday_session=" + "A".repeat(43);
  check((await c.post("current-session")).status === 401, "unknown token -> 401");
}

console.log("per-email lockout");
{
  const c = new Client();
  const acct = account("lk");
  await c.post("createAccount", acct);
  let statuses = [];
  for (let i = 0; i < 10; i++) {
    statuses.push((await c.post("logIn", { username: acct.email, password: "wrong-password" })).status);
  }
  check(statuses.every((s) => s === 400), "10 wrong passwords -> 400 each");
  let r = await c.post("logIn", { username: acct.email, password: PW });
  check(r.status === 429 && Number(r.retryAfter) > 0, "11th try locked even with the right password -> " + r.status);
  check(typeof r.data === "string" && /try again in 1[45] minutes/.test(r.data), "message says when: " + r.data);

  const ghost = `nobody${suffix}@t.com`;
  for (let i = 0; i < 10; i++) {
    await c.post("logIn", { username: ghost, password: "wrong-password" });
  }
  r = await c.post("logIn", { username: ghost, password: "wrong-password" });
  check(r.status === 429, "unknown emails lock the same way (no account enumeration) -> " + r.status);

  const other = new Client();
  r = await other.post("logIn", { username: acctA.email, password: PW });
  check(r.status === 200, "other accounts unaffected");
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall auth checks passed");
process.exit(failures ? 1 : 0);
