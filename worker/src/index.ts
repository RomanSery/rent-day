import { Hono } from "hono";
import { toSeed } from "./game/random";
import type { Context } from "hono";
import { GameStatus } from "@core/enums/GameStatus";
import { PieceType } from "@core/enums/PieceType";
import { PlayerClass } from "@core/enums/PlayerClass";
import { SkillType } from "@core/enums/SkillType";
import { BotLevel } from "@core/enums/BotLevel";
import { PlayerInfo } from "@core/types/PlayerInfo";
import { Env, isDevEnv } from "./env";
import { clearSessionCookie, createSession, endAllSessions, endSession, getSession } from "./auth/session";
import { allowByIp, clearFailures, lockedForSeconds, recordFailure, tooManyRequests } from "./auth/throttle";
import { verifyTurnstile } from "./auth/turnstile";
import { DEFAULT_ITERATIONS, hashPassword, isLegacyHash, verifyPassword } from "./auth/password";
import { UsersRepo } from "./db/users";
import { GamesIndexRepo } from "./db/gamesIndex";
import { HistoryRepo } from "./db/history";
import { ContactRepo } from "./db/contact";
import { CONTACT_SUBJECTS, ContactMessage } from "@core/types/ContactMessage";
import { PlayerProfile } from "@core/types/PlayerProfile";
import { isValidId, newId } from "./game/ids";
import { UserDocument } from "./game/model";
import { ActionResult, GameRoom } from "./game/GameRoom";
import { meterD1, meterStub, resetWorkerUsage, workerUsage } from "./dev/usage";

export { GameRoom };

type AppContext = Context<{ Bindings: Env }>;
type Body = Record<string, any>;

const app = new Hono<{ Bindings: Env }>();

// development only: count requests and D1 rows for worker/test/usage.mjs
app.use("*", async (c, next) => {
  if (isDevEnv(c.env) && !c.req.path.startsWith("/api/dev/usage")) {
    workerUsage.requests++;
    c.env = { ...c.env, DB: meterD1(c.env.DB, () => workerUsage.d1) };
  }
  await next();
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const readBody = async (c: AppContext): Promise<Body> => {
  try {
    const body = await c.req.json();
    return body && typeof body === "object" ? body : {};
  } catch (e) {
    return {};
  }
};

/** Same shape express-validator produced, which the client already handles. */
const validationError = (c: AppContext, msg: string, param: string) =>
  c.json({ errors: [{ msg, param, location: "body" }] }, 400);

const invalidAuth = (c: AppContext) => c.text("Invalid auth token", 400);

const requireUserId = async (c: AppContext): Promise<string | null> => {
  const session = await getSession(c);
  return session ? session.id : null;
};

const roomFor = (c: AppContext, gameId: string) => {
  const stub = c.env.GAME_ROOM.get(c.env.GAME_ROOM.idFromName(gameId));
  return isDevEnv(c.env) ? meterStub(stub) : stub;
};

const gameIdFromContext = (body: Body): string | null => {
  const gameId = body?.context?.gameId;
  return isValidId(gameId) ? gameId : null;
};

/** A whole number from a JSON number or a digits-only string; anything else is null. */
const toInt = (value: unknown): number | null => {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\s*-?\d{1,15}\s*$/.test(value)
        ? Number(value)
        : NaN;
  return Number.isSafeInteger(n) ? n : null;
};

/** The same limits as the create-game form. */
const GAME_LIMITS = {
  minMoney: 500,
  maxMoney: 5000,
  maxSkillPoints: 10,
  maxPasswordLength: 64,
  /** lobbies one user may have waiting for players at once */
  maxOpenLobbies: 3,
};

const cleanText = (value: unknown, max: number): string =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim()
    .substring(0, max);

/** The accounts that may read Contact Us messages (ADMIN_EMAILS). */
const isAdmin = (env: Env, user: UserDocument): boolean =>
  (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(user.email.toLowerCase());

const sessionResponse = (env: Env, user: UserDocument, currGameId: string | null) => ({
  id: user._id,
  userName: user.username,
  currGameId,
  // only shows the inbox link; the admin routes check for themselves
  isAdmin: isAdmin(env, user),
});

/** a game without a move for this long leaves the watch list */
const WATCH_IDLE_SECONDS = 30 * 60;

const devIdleSeconds = (env: Env): number => {
  const n = isDevEnv(env) ? parseInt(env.DEV_WATCH_IDLE_SECONDS ?? "", 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : WATCH_IDLE_SECONDS;
};

const pbkdf2Iterations = (env: Env): number => {
  const n = parseInt(env.PBKDF2_ITERATIONS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ITERATIONS;
};

const respondAction = (c: AppContext, result: ActionResult) => {
  if (result.errMsg) {
    return c.text(result.errMsg, 400);
  }
  return c.json({ status: "success", ...(result.data ?? {}) });
};

/**
 * Looks up the user's current game and clears it if that game no longer
 * exists or has finished. Returns the still-active game id or null.
 */
const resolveCurrentGame = async (
  c: AppContext,
  users: UsersRepo,
  user: UserDocument
): Promise<string | null> => {
  if (!user.currGameId || !isValidId(user.currGameId)) {
    return null;
  }
  const room = roomFor(c, user.currGameId);
  const status = await room.getStatus();
  const inGame = status && status !== GameStatus.FINISHED
    ? await room.isPlayerInGame(user._id)
    : false;

  if (!status || status === GameStatus.FINISHED) {
    user.currGameId = undefined;
    user.currGameName = undefined;
    await users.save(user);
    return null;
  }
  return inGame ? user.currGameId : null;
};

app.onError((err, c) => {
  console.log("unhandled error", err);
  return c.text("Something went wrong", 500);
});

// ---------------------------------------------------------------------------
// health
// ---------------------------------------------------------------------------

app.get("/api/health", (c) => c.json({ status: "UP" }));

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const wantsRemember = (body: Body): boolean => body.remember === true;

app.post("/api/createAccount", async (c) => {
  if (!(await allowByIp(c, c.env.SIGNUP_LIMITER, "signup"))) {
    return tooManyRequests(c, 60, "Too many new accounts from your network. Please try again in a minute.");
  }

  const body = await readBody(c);
  const email = String(body.email ?? "").toLowerCase().trim();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return validationError(c, "Email is not valid", "email");
  }
  if (!/^[A-Za-z0-9]{4,10}$/.test(username)) {
    return validationError(c, "Username missing", "username");
  }
  if (password.length === 0) {
    return validationError(c, "Password missing", "password");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return validationError(c, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`, "password");
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return validationError(c, `Password must be ${MAX_PASSWORD_LENGTH} characters or less`, "password");
  }
  if (password !== confirmPassword) {
    return validationError(c, "Passwords do not match", "confirmPassword");
  }

  // the bot check comes before the lookup below, so a script can't use this
  // endpoint to find out which emails and usernames are taken
  const captcha = await verifyTurnstile(c, body.turnstileToken, "signup");
  if (!captcha.ok) {
    if (captcha.reason === "unavailable") {
      return c.text("Sign-up is not available right now. Please try again later.", 503);
    }
    return validationError(
      c,
      captcha.reason === "missing"
        ? "Please complete the \"verify you are human\" check"
        : "The \"verify you are human\" check failed or expired. Please try it again.",
      "turnstileToken"
    );
  }

  const users = new UsersRepo(c.env.DB);
  const modifiedUsername = username.toLowerCase();
  if (await users.existsByEmailOrUsername(email, modifiedUsername)) {
    return c.text("Username/Email already taken", 403);
  }

  const now = new Date().toISOString();
  const user: UserDocument = {
    _id: newId(),
    email,
    username,
    modifiedUsername,
    password: await hashPassword(password, pbkdf2Iterations(c.env)),
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    currentStreak: 0,
    bestStreak: 0,
    bestWinWorth: 0,
    rentCollected: 0,
    auctionsWon: 0,
    createdAt: now,
    updatedAt: now,
  };
  await users.create(user);

  await createSession(c, user._id, wantsRemember(body));
  return c.json(sessionResponse(c.env, user, null));
});

// Checked when the email has no account, so a wrong email takes as long as a
// wrong password and the response time does not reveal which emails exist.
let dummyHash: Promise<string> | null = null;
const dummyPasswordCheck = (env: Env, password: string): Promise<boolean> => {
  dummyHash ??= hashPassword("not-a-real-password", pbkdf2Iterations(env));
  return dummyHash.then((hash) => verifyPassword(password, hash));
};

const login = async (c: AppContext) => {
  if (!(await allowByIp(c, c.env.LOGIN_LIMITER, "login"))) {
    return tooManyRequests(c, 60, "Too many login attempts from your network. Please try again in a minute.");
  }

  const body = await readBody(c);
  // the login form sends the email in the "username" field
  const email = String(body.username ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return validationError(c, "Username missing", "username");
  }
  if (password.length === 0) {
    return validationError(c, "Password missing", "password");
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return c.text("Invalid username/password", 400);
  }

  const lockedFor = await lockedForSeconds(c, email);
  if (lockedFor > 0) {
    const minutes = Math.ceil(lockedFor / 60);
    return tooManyRequests(
      c,
      lockedFor,
      `Too many failed logins for this account. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
    );
  }

  const users = new UsersRepo(c.env.DB);
  const user = await users.findByEmail(email);
  const passwordOk = user
    ? await verifyPassword(password, user.password)
    : await dummyPasswordCheck(c.env, password).then(() => false);
  if (!user || !passwordOk) {
    await recordFailure(c, email);
    return c.text("Invalid username/password", 400);
  }
  await clearFailures(c, email);

  if (isLegacyHash(user.password)) {
    // upgrade a bcrypt hash imported from the old database
    user.password = await hashPassword(password, pbkdf2Iterations(c.env));
    await users.save(user);
  }

  const currGameId = await resolveCurrentGame(c, users, user);
  await createSession(c, user._id, wantsRemember(body));
  return c.json(sessionResponse(c.env, user, currGameId));
};
app.post("/api/login", login);
app.post("/api/logIn", login); // the React client calls this spelling

/** Log out this browser. */
app.post("/api/logout", async (c) => {
  await endSession(c);
  return c.json({});
});

/** Log out on every device: revokes all of the user's sessions. */
app.post("/api/logoutAll", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) {
    return invalidAuth(c);
  }
  await endAllSessions(c, userId);
  return c.json({});
});

app.post("/api/current-session", async (c) => {
  const session = await getSession(c);
  if (!session) {
    clearSessionCookie(c);
    return c.body(null, 401);
  }
  const users = new UsersRepo(c.env.DB);
  const user = await users.findById(session.id);
  if (!user) {
    await endSession(c);
    return c.body(null, 401);
  }
  const currGameId = await resolveCurrentGame(c, users, user);
  return c.json(sessionResponse(c.env, user, currGameId));
});

// ---------------------------------------------------------------------------
// contact us: anyone may send a message; admins read them
// ---------------------------------------------------------------------------

const CONTACT_LIMITS = {
  name: 60,
  message: 2000,
  /** messages kept per rolling 24 hours, from everyone: a cap on floods */
  perDay: 200,
  /** messages an admin's inbox shows */
  inbox: 200,
};

/** Plain text for storage (React escapes it when shown): no control characters but line breaks. */
const plainText = (value: unknown, max: number): string =>
  String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim()
    .substring(0, max);

app.post("/api/contact", async (c) => {
  const body = await readBody(c);
  // a field people never see: only bots fill it in. Pretend it worked.
  if (body.website) {
    return c.json({ status: "success" });
  }
  if (!(await allowByIp(c, c.env.CONTACT_LIMITER, "contact"))) {
    return tooManyRequests(c, 60, "Too many messages. Please wait a minute and try again.");
  }

  const email = String(body.email ?? "").toLowerCase().trim();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return validationError(c, "Please enter a valid email address so we can reply", "email");
  }
  const subject = String(body.subject ?? "");
  if (!Object.prototype.hasOwnProperty.call(CONTACT_SUBJECTS, subject)) {
    return validationError(c, "Please pick a subject", "subject");
  }
  const message = plainText(body.message, CONTACT_LIMITS.message);
  if (!message) {
    return validationError(c, "Please write a message", "message");
  }
  if (String(body.message ?? "").trim().length > CONTACT_LIMITS.message) {
    return validationError(c, `Messages can be up to ${CONTACT_LIMITS.message} characters`, "message");
  }

  const repo = new ContactRepo(c.env.DB);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if ((await repo.countSince(dayAgo)) >= CONTACT_LIMITS.perDay) {
    return c.text("We've received a lot of messages today. Please try again tomorrow.", 429);
  }

  const session = await getSession(c);
  await repo.insert({
    id: newId(),
    createdAt: new Date().toISOString(),
    email,
    name: plainText(body.name, CONTACT_LIMITS.name),
    subject,
    message,
    userId: session?.id,
    username: session?.userName,
  });
  return c.json({ status: "success" });
});

/** The signed-in admin, or null (the routes then answer 404, as if they didn't exist). */
const requireAdmin = async (c: AppContext): Promise<UserDocument | null> => {
  const userId = await requireUserId(c);
  if (!userId) {
    return null;
  }
  const user = await new UsersRepo(c.env.DB).findById(userId);
  return user && isAdmin(c.env, user) ? user : null;
};

app.post("/api/admin/messages", async (c) => {
  if (!(await requireAdmin(c))) {
    return c.text("Not found", 404);
  }
  const messages: ContactMessage[] = await new ContactRepo(c.env.DB).list(CONTACT_LIMITS.inbox);
  return c.json({ messages });
});

app.post("/api/admin/messages/delete", async (c) => {
  if (!(await requireAdmin(c))) {
    return c.text("Not found", 404);
  }
  const body = await readBody(c);
  if (!isValidId(body.id)) {
    return c.text("invalid id", 400);
  }
  await new ContactRepo(c.env.DB).remove(body.id);
  return c.json({ status: "success" });
});

// ---------------------------------------------------------------------------
// lobby
// ---------------------------------------------------------------------------

app.post("/api/findGames", async (c) => {
  if (!(await requireUserId(c))) {
    return invalidAuth(c);
  }
  const repo = new GamesIndexRepo(c.env.DB);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // games in progress to watch: created in the last week, with a move in
  // the last half hour (games record their latest move every few minutes)
  const createdSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const idleSeconds = devIdleSeconds(c.env);
  const activeSince = new Date(Date.now() - idleSeconds * 1000).toISOString();
  const [games, live] = await Promise.all([repo.listJoining(since), repo.listWatchable(createdSince, activeSince)]);
  return c.json({ games, live });
});

app.post("/api/findPlayers", async (c) => {
  if (!(await requireUserId(c))) {
    return invalidAuth(c);
  }
  const users = await new UsersRepo(c.env.DB).listTop(500);
  const players: PlayerInfo[] = users.map((u) => ({
    playerId: u._id,
    name: u.username,
    wins: u.wins,
    losses: u.losses,
    gamesPlayed: u.gamesPlayed,
    currentStreak: u.currentStreak,
    bestStreak: u.bestStreak,
    bestWinWorth: u.bestWinWorth,
    rentCollected: u.rentCollected,
    auctionsWon: u.auctionsWon,
    lastPlayedAt: u.lastPlayedAt,
    memberSince: u.createdAt,
    currGame: u.currGameName,
  }));
  return c.json({ players });
});

// A player's profile: their account totals plus what their finished games
// show (win rate by class, favourite properties, head-to-head records,
// biggest comeback, recent games). Any signed-in player may look, like the
// leaderboard.
app.post("/api/getProfile", async (c) => {
  if (!(await requireUserId(c))) {
    return invalidAuth(c);
  }
  const body = await readBody(c);
  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  const user = isValidId(playerId) ? await new UsersRepo(c.env.DB).findById(playerId) : null;
  if (!user) {
    return c.json({ message: "Player not found" }, 404);
  }
  const stats = await new HistoryRepo(c.env.DB).statsFor(user._id);
  const profile: PlayerProfile = {
    playerId: user._id,
    name: user.username,
    memberSince: user.createdAt,
    wins: user.wins,
    losses: user.losses,
    gamesPlayed: user.gamesPlayed,
    currentStreak: user.currentStreak,
    bestStreak: user.bestStreak,
    bestWinWorth: user.bestWinWorth,
    rentCollected: user.rentCollected,
    auctionsWon: user.auctionsWon,
    currGame: user.currGameName,
    ...stats,
  };
  return c.json({ profile });
});

app.post("/api/createGame", async (c) => {
  const userId = await requireUserId(c);
  if (!userId) {
    return invalidAuth(c);
  }
  const body = await readBody(c);
  const data: Body = body.data ?? {};

  const gameName = cleanText(data.gameName, 60);
  const maxPlayers = toInt(data.maxPlayers);
  const initialMoney = toInt(data.initialMoney);
  const initialSkillPoints = toInt(data.initialSkillPoints);

  if (gameName.length === 0) {
    return validationError(c, "Game name is missing/invalid", "data.gameName");
  }
  if (maxPlayers == null || maxPlayers < 2 || maxPlayers > 6) {
    return validationError(c, "# of players missing", "data.maxPlayers");
  }
  if (initialMoney == null || initialMoney < GAME_LIMITS.minMoney || initialMoney > GAME_LIMITS.maxMoney) {
    return validationError(
      c,
      `Starting money must be $${GAME_LIMITS.minMoney} to $${GAME_LIMITS.maxMoney}`,
      "data.initialMoney"
    );
  }
  if (initialSkillPoints == null || initialSkillPoints < 0 || initialSkillPoints > GAME_LIMITS.maxSkillPoints) {
    return validationError(
      c,
      `Starting skill points must be 0 to ${GAME_LIMITS.maxSkillPoints}`,
      "data.initialSkillPoints"
    );
  }
  const gamePwd = data.gamePwd ? String(data.gamePwd) : null;
  if (gamePwd && gamePwd.length > GAME_LIMITS.maxPasswordLength) {
    return validationError(
      c,
      `Game password must be ${GAME_LIMITS.maxPasswordLength} characters or less`,
      "data.gamePwd"
    );
  }
  if ((await new GamesIndexRepo(c.env.DB).countOpenLobbies(userId)) >= GAME_LIMITS.maxOpenLobbies) {
    return c.text(
      `You already have ${GAME_LIMITS.maxOpenLobbies} games waiting for players. Start one of them or wait for it to expire.`,
      429
    );
  }

  const numBots = toInt(data.numBots) ?? 0;
  if (numBots < 0 || numBots > maxPlayers - 1) {
    return validationError(c, "Computer players must leave a seat for you", "data.numBots");
  }
  const botLevel = Object.values(BotLevel).includes(data.botLevel) ? (data.botLevel as BotLevel) : BotLevel.Normal;

  const gameId = newId();
  const room = roomFor(c, gameId);
  await room.createGame(
    {
      gameId,
      gameName,
      maxPlayers,
      initialMoney,
      initialSkillPoints,
      userId,
      password: gamePwd,
      useTimers: !!data.useTimers,
      // development only: a fixed seed replays the same dice (tests, bug reports)
      seed: isDevEnv(c.env) ? toSeed(data.seed) : undefined,
    },
    numBots,
    botLevel
  );

  return c.json({ gameId });
});

/**
 * Development only: create a game played entirely by computer players.
 * Body: { levels: ["Normal", "Easy", ...], initialMoney?: number }
 * Used by worker/test/sim.mjs to measure the bots against each other.
 */
app.post("/api/dev/simulate", async (c) => {
  if (!isDevEnv(c.env)) {
    return c.text("Not found", 404);
  }
  const body = await readBody(c);
  const levels: BotLevel[] = Array.isArray(body.levels)
    ? body.levels.filter((l: unknown): l is BotLevel => Object.values(BotLevel).includes(l as BotLevel))
    : [];
  if (levels.length < 2 || levels.length > 6) {
    return c.text("levels must list 2 to 6 bot levels", 400);
  }
  const gameId = newId();
  await roomFor(c, gameId).createGame(
    {
      gameId,
      gameName: "Simulation " + gameId.slice(-4),
      maxPlayers: levels.length,
      initialMoney: toInt(body.initialMoney) ?? 1500,
      initialSkillPoints: toInt(body.initialSkillPoints) ?? 5,
      userId: "simulation",
      password: null,
      useTimers: false,
      botsOnly: true,
      seed: toSeed(body.seed),
    },
    levels.length,
    BotLevel.Normal,
    levels
  );
  return c.json({ gameId });
});

/**
 * Development only: the usage meters (dev/usage.ts). Body: { gameIds: [...] }.
 * Returns the Worker's totals and each game object's own.
 */
app.post("/api/dev/usage", async (c) => {
  if (!isDevEnv(c.env)) {
    return c.text("Not found", 404);
  }
  const body = await readBody(c);
  const ids: string[] = Array.isArray(body.gameIds) ? body.gameIds.filter(isValidId) : [];
  const rooms: Record<string, unknown> = {};
  for (const id of ids) {
    // straight to the stub so reading the meters isn't metered
    rooms[id] = await c.env.GAME_ROOM.get(c.env.GAME_ROOM.idFromName(id)).getDevUsage();
  }
  return c.json({ worker: workerUsage, rooms });
});

app.post("/api/dev/usage/reset", async (c) => {
  if (!isDevEnv(c.env)) {
    return c.text("Not found", 404);
  }
  const body = await readBody(c);
  const ids: string[] = Array.isArray(body.gameIds) ? body.gameIds.filter(isValidId) : [];
  for (const id of ids) {
    await c.env.GAME_ROOM.get(c.env.GAME_ROOM.idFromName(id)).resetDevUsage();
  }
  resetWorkerUsage();
  return c.json({});
});

app.post("/api/dev/game", async (c) => {
  if (!isDevEnv(c.env)) {
    return c.text("Not found", 404);
  }
  const body = await readBody(c);
  if (!isValidId(body.gameId)) {
    return c.text("missing gameId", 400);
  }
  return c.json({ game: await roomFor(c, body.gameId).getGame() });
});

app.post("/api/addBot", async (c) => {
  const body = await readBody(c);
  if (!isValidId(body.gameId)) {
    return validationError(c, "GameId missing", "gameId");
  }
  const userId = await requireUserId(c);
  if (!userId) {
    return invalidAuth(c);
  }
  const level = Object.values(BotLevel).includes(body.level) ? (body.level as BotLevel) : BotLevel.Normal;
  const { errMsg, result } = await roomFor(c, body.gameId).addBot(userId, level);
  if (errMsg || !result) {
    return c.text(errMsg || "Could not add a computer player", 400);
  }
  return c.json(result);
});

app.post("/api/getGame", async (c) => {
  const body = await readBody(c);
  if (!isValidId(body.gameId)) {
    return validationError(c, "invalid gameId", "gameId");
  }
  const userId = await requireUserId(c);
  if (!userId) {
    return invalidAuth(c);
  }
  const { game, forbidden } = await roomFor(c, body.gameId).getGameFor(userId);
  if (forbidden) {
    return c.text("You are not a player in this game", 403);
  }
  return c.json({ game });
});

// per-turn snapshots of a game, for replays and net-worth charts
app.post("/api/getSnapshots", async (c) => {
  const body = await readBody(c);
  if (!isValidId(body.gameId)) {
    return validationError(c, "invalid gameId", "gameId");
  }
  const userId = await requireUserId(c);
  if (!userId) {
    return invalidAuth(c);
  }
  const { snapshots, forbidden } = await roomFor(c, body.gameId).getSnapshotsFor(userId);
  if (forbidden) {
    return c.text("You are not a player in this game", 403);
  }
  return c.json({ snapshots });
});

app.post("/api/getGameStatus", async (c) => {
  const body = await readBody(c);
  if (!isValidId(body.gameId)) {
    return c.text("missing gameId", 400);
  }
  const userId = await requireUserId(c);
  if (!userId) {
    return invalidAuth(c);
  }

  const status = await roomFor(c, body.gameId).getStatus();

  if (!status || status === GameStatus.FINISHED) {
    const users = new UsersRepo(c.env.DB);
    const user = await users.findById(userId);
    if (user && user.currGameId && user.currGameId === body.gameId) {
      user.currGameId = undefined;
      user.currGameName = undefined;
      await users.save(user);
    }
  }

  return c.json({ status });
});

app.post("/api/getAuction", async (c) => {
  const body = await readBody(c);
  if (!isValidId(body.auctionId)) {
    return c.text("missing auctionId", 400);
  }
  const userId = await requireUserId(c);
  if (!userId) {
    return invalidAuth(c);
  }
  const gameId = gameIdFromContext(body);
  if (!gameId) {
    return c.text("missing gameId", 400);
  }
  const auction = await roomFor(c, gameId).getAuction(body.auctionId, userId);
  return c.json({ auction });
});

app.post("/api/getLotto", async (c) => {
  const body = await readBody(c);
  if (!isValidId(body.lottoId)) {
    return c.text("missing lottoId", 400);
  }
  const userId = await requireUserId(c);
  if (!userId) {
    return invalidAuth(c);
  }
  const gameId = gameIdFromContext(body);
  if (!gameId) {
    return c.text("missing gameId", 400);
  }
  const lotto = await roomFor(c, gameId).getLotto(body.lottoId, userId);
  return c.json({ lotto });
});

app.post("/api/joinGame", async (c) => {
  const body = await readBody(c);
  if (!isValidId(body.gameId)) {
    return validationError(c, "GameId missing", "gameId");
  }
  const userId = await requireUserId(c);
  if (!userId) {
    return invalidAuth(c);
  }

  const piece = String(body.piece ?? "").trim() as PieceType;
  const playerClass = String(body.playerClass ?? "").trim() as PlayerClass;
  if (!Object.values(PieceType).includes(piece)) {
    return c.text("Invalid piece", 400);
  }
  if (!Object.values(PlayerClass).includes(playerClass)) {
    return c.text("Invalid player class", 400);
  }

  // one game at a time: joining another lobby would detach the account
  // from the game it is still playing
  const users = new UsersRepo(c.env.DB);
  const user = await users.findById(userId);
  if (user) {
    const currentGameId = await resolveCurrentGame(c, users, user);
    if (currentGameId && currentGameId !== body.gameId) {
      return c.text("You are already in another game. Leave it first.", 400);
    }
  }

  const { errMsg, result } = await roomFor(c, body.gameId).joinGame(
    userId,
    piece,
    playerClass,
    body.gamePwd ? String(body.gamePwd) : null
  );
  if (errMsg || !result) {
    return c.text(errMsg || "Error joining", 400);
  }
  return c.json({ ...result, userId });
});

app.post("/api/leaveGame", async (c) => {
  const body = await readBody(c);
  if (!isValidId(body.gameId)) {
    return validationError(c, "GameId missing", "gameId");
  }
  const userId = await requireUserId(c);
  if (!userId) {
    return invalidAuth(c);
  }
  await roomFor(c, body.gameId).leaveGame(userId);
  return c.json({ status: "success" });
});

app.post("/api/resignGame", async (c) => {
  const body = await readBody(c);
  if (!isValidId(body.gameId)) {
    return validationError(c, "GameId missing", "gameId");
  }
  const userId = await requireUserId(c);
  if (!userId) {
    return invalidAuth(c);
  }
  await roomFor(c, body.gameId).resignGame(userId);
  return c.json({ status: "success" });
});

// ---------------------------------------------------------------------------
// in-game actions: all forwarded to the game's Durable Object
// ---------------------------------------------------------------------------

type ActionHandler = (
  room: DurableObjectStub<GameRoom>,
  userId: string,
  body: Body
) => Promise<ActionResult>;

const action = (handler: ActionHandler) => async (c: AppContext) => {
  const userId = await requireUserId(c);
  if (!userId) {
    return invalidAuth(c);
  }
  const body = await readBody(c);
  const gameId = gameIdFromContext(body);
  if (!gameId) {
    return c.text("Invalid request", 400);
  }
  const result = await handler(roomFor(c, gameId), userId, body);
  return respondAction(c, result);
};

const squareAction = (
  fn: (room: DurableObjectStub<GameRoom>, userId: string, squareId: number) => Promise<ActionResult>
) =>
  action(async (room, userId, body) => {
    const squareId = toInt(body.squareId);
    if (squareId == null) {
      return { errMsg: "Invalid squareId" };
    }
    return fn(room, userId, squareId);
  });

app.post(
  "/api/actions/roll",
  action((room, userId, body) =>
    room.roll(userId, toInt(body.forceDie1), toInt(body.forceDie2), toInt(body.forceChanceId))
  )
);

app.post(
  "/api/actions/travel",
  squareAction((room, userId, squareId) => room.travel(userId, squareId))
);

app.post(
  "/api/actions/completeTurn",
  action((room, userId) => room.completeTurn(userId))
);

app.post(
  "/api/actions/timesUpAction",
  action((room) => room.timesUp())
);

app.post(
  "/api/actions/bid",
  action(async (room, userId, body) => {
    const bid = toInt(body.bid);
    if (bid == null) {
      return { errMsg: "Bid is not valid" };
    }
    return room.bid(userId, bid);
  })
);

app.post(
  "/api/actions/pickLotto",
  action(async (room, userId, body) => {
    const opt = toInt(body.opt);
    if (opt == null) {
      return { errMsg: "Opt is not valid" };
    }
    return room.pickLotto(userId, opt);
  })
);

app.post(
  "/api/actions/chanceChoice",
  action(async (room, userId, body) => {
    const choice = body.choice;
    if (typeof choice !== "string" || choice.length === 0 || choice.length > 20) {
      return { errMsg: "Choice is not valid" };
    }
    return room.chooseChance(userId, choice);
  })
);

app.post(
  "/api/actions/mortgage",
  squareAction((room, userId, squareId) => room.mortgage(userId, squareId))
);
app.post(
  "/api/actions/redeem",
  squareAction((room, userId, squareId) => room.redeem(userId, squareId))
);
app.post(
  "/api/actions/buildHouse",
  squareAction((room, userId, squareId) => room.buildHouse(userId, squareId))
);
app.post(
  "/api/actions/sellHouse",
  squareAction((room, userId, squareId) => room.sellHouse(userId, squareId))
);

app.post(
  "/api/actions/getOut",
  action((room, userId) => room.getOut(userId))
);

app.post(
  "/api/actions/offerTrade",
  action(async (room, userId, body) => {
    if (!isValidId(body.tradingWithPlayerId)) {
      return { errMsg: "Invalid player" };
    }
    const toSquareIds = (v: unknown): number[] =>
      Array.isArray(v) ? v.map(toInt).filter((n): n is number => n != null) : [];
    return room.offerTrade(
      userId,
      body.tradingWithPlayerId,
      toSquareIds(body.mines),
      toSquareIds(body.theirs),
      toInt(body.myAmount) ?? 0,
      toInt(body.theirAmount) ?? 0
    );
  })
);

app.post(
  "/api/actions/acceptTrade",
  action(async (room, userId, body) => {
    if (!isValidId(body.tradeId)) {
      return { errMsg: "Trade not found" };
    }
    return room.acceptTrade(userId, body.tradeId);
  })
);

app.post(
  "/api/actions/declineTrade",
  action(async (room, userId, body) => {
    if (!isValidId(body.tradeId)) {
      return { errMsg: "trade not found" };
    }
    return room.declineTrade(userId, body.tradeId);
  })
);

app.post(
  "/api/actions/upgradeSkill",
  action(async (room, userId, body) => {
    const skillType = body.skillType;
    if (
      skillType !== SkillType.Negotiation &&
      skillType !== SkillType.Corruption &&
      skillType !== SkillType.Luck
    ) {
      return { errMsg: "Invalid request" };
    }
    return room.upgradeSkill(userId, skillType);
  })
);

// ---------------------------------------------------------------------------
// realtime: WebSocket per game, handled by the game's Durable Object
// ---------------------------------------------------------------------------

app.get("/ws", async (c) => {
  if (c.req.header("Upgrade") !== "websocket") {
    return c.text("Expected a WebSocket upgrade", 426);
  }
  const session = await getSession(c);
  if (!session) {
    return c.text("Unauthorized", 401);
  }
  const gameId = c.req.query("gameId");
  if (!isValidId(gameId)) {
    return c.text("missing gameId", 400);
  }

  const headers = new Headers(c.req.raw.headers);
  headers.set("X-User-Id", session.id);
  headers.set("X-User-Name", session.userName);
  return roomFor(c, gameId).fetch(new Request(c.req.raw.url, { method: "GET", headers }));
});

// Anything else is a static asset from the React build.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
