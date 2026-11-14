// Contact Us: anyone can send a message, it is stored in D1, and only the
// accounts in ADMIN_EMAILS can read or delete messages.
//
//   npx wrangler dev --var ADMIN_EMAILS:inbox-admin@t.com    # in worker/
//   npm run test:api:contact
//
// ADMIN_EMAIL=... to match a different ADMIN_EMAILS entry.

const BASE = process.env.BASE || "http://localhost:8787";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "inbox-admin@t.com";
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
}

const suffix = Date.now().toString(36).slice(-5);
const PASSWORD = "pw-contact-test-1";

/** The admin account: created on the first run, logged into after that. */
const adminClient = async () => {
  const c = new Client();
  let r = await c.post("createAccount", { email: ADMIN_EMAIL, username: "inboxadm", password: PASSWORD, confirmPassword: PASSWORD });
  if (r.status !== 200) {
    r = await c.post("logIn", { username: ADMIN_EMAIL, password: PASSWORD });
  }
  if (r.status !== 200) throw new Error("admin login failed: " + JSON.stringify(r.data));
  return { client: c, session: r.data };
};

const anon = new Client();
const member = new Client();
let r = await member.post("createAccount", { email: `cm${suffix}@t.com`, username: `cm${suffix}`, password: PASSWORD, confirmPassword: PASSWORD });
check(r.status === 200, "member account created");
check(r.data.isAdmin === false, "member is not an admin");
const memberName = r.data.userName;
const { client: admin, session: adminSession } = await adminClient();
check(adminSession.isAdmin === true, "ADMIN_EMAILS account is an admin");
r = await admin.post("current-session");
check(r.data.isAdmin === true, "current-session says admin too");

console.log("sending");
const tag = "t" + suffix;
const tricky = `<b>${tag}</b> & "quotes"\nsecond line`;
r = await anon.post("contact", { email: "Someone@Example.com", name: "Sam", subject: "bugs", message: tricky });
check(r.status === 200, "signed-out visitor can send -> " + r.status + " " + JSON.stringify(r.data));
r = await member.post("contact", { email: `cm${suffix}@t.com`, subject: "feedback", message: "from a member " + tag });
check(r.status === 200, "signed-in member can send -> " + r.status);
r = await anon.post("contact", { email: "bot@spam.com", subject: "general", message: "buy stuff " + tag, website: "http://spam" });
check(r.status === 200, "honeypot filled: pretends to succeed -> " + r.status);

console.log("validation");
r = await anon.post("contact", { subject: "general", message: "hi" });
check(r.status === 400 && r.data.errors?.[0]?.param === "email", "missing email refused");
r = await anon.post("contact", { email: "not-an-email", subject: "general", message: "hi" });
check(r.status === 400, "bad email refused");
r = await anon.post("contact", { email: "a@b.com", subject: "nonsense", message: "hi" });
check(r.status === 400 && r.data.errors?.[0]?.param === "subject", "unknown subject refused");
r = await anon.post("contact", { email: "a@b.com", subject: "toString", message: "hi" });
check(r.status === 400, "prototype key as subject refused");
r = await anon.post("contact", { email: "a@b.com", subject: "general", message: "   " });
check(r.status === 400 && r.data.errors?.[0]?.param === "message", "blank message refused");
r = await anon.post("contact", { email: "a@b.com", subject: "general", message: "x".repeat(2001) });
check(r.status === 400, "2001-character message refused");

console.log("reading");
r = await anon.post("admin/messages");
check(r.status === 404, "signed out: inbox is 404 -> " + r.status);
r = await member.post("admin/messages");
check(r.status === 404, "non-admin: inbox is 404 -> " + r.status);
r = await admin.post("admin/messages");
check(r.status === 200 && Array.isArray(r.data.messages), "admin can read the inbox");
const mine = (r.data.messages ?? []).filter((m) => m.message.includes(tag));
check(mine.length === 2, "both real messages stored, the honeypot one not: " + mine.length);
const fromAnon = mine.find((m) => m.subject === "bugs");
const fromMember = mine.find((m) => m.subject === "feedback");
check(fromAnon?.message === tricky, "message kept as plain text, line break included: " + JSON.stringify(fromAnon?.message));
check(fromAnon?.email === "someone@example.com" && fromAnon?.name === "Sam" && !fromAnon?.userId, "visitor's email lower-cased, name kept, no account");
check(fromMember?.userId && fromMember?.username === memberName, "member's account attached: " + fromMember?.username);
check(r.data.messages[0].createdAt >= r.data.messages[r.data.messages.length - 1].createdAt, "newest first");

console.log("deleting");
r = await member.post("admin/messages/delete", { id: fromAnon.id });
check(r.status === 404, "non-admin can't delete -> " + r.status);
r = await admin.post("admin/messages/delete", { id: fromAnon.id });
check(r.status === 200, "admin deletes a message");
r = await admin.post("admin/messages");
check(!r.data.messages.some((m) => m.id === fromAnon.id), "deleted message is gone");
check(r.data.messages.some((m) => m.id === fromMember.id), "the other one is still there");
await admin.post("admin/messages/delete", { id: fromMember.id });

console.log(failures === 0 ? "\nall contact checks passed" : `\n${failures} contact check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
