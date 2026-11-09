import { Hono } from "hono";
import type { Context } from "hono";
import { GameStatus } from "@core/enums/GameStatus";
import { PieceType } from "@core/enums/PieceType";
import { PlayerClass } from "@core/enums/PlayerClass";
import { SkillType } from "@core/enums/SkillType";
import { BotLevel } from "@core/enums/BotLevel";
import { PlayerInfo } from "@core/types/PlayerInfo";
import { Env } from "./env";
import { clearSession, createSession, getSession } from "./auth/session";
import { DEFAULT_ITERATIONS, hashPassword, isLegacyHash, verifyPassword } from "./auth/password";
import { UsersRepo } from "./db/users";
import { GamesIndexRepo } from "./db/gamesIndex";
import { isValidId, newId } from "./game/ids";
import { UserDocument } from "./game/model";
import { ActionResult, GameRoom } from "./game/GameRoom";

export { GameRoom };

type AppContext = Context<{ Bindings: Env }>;
type Body = Record<string, any>;

const app = new Hono<{ Bindings: Env }>();

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

const roomFor = (c: AppContext, gameId: string) =>
  c.env.GAME_ROOM.get(c.env.GAME_ROOM.idFromName(gameId));

const gameIdFromContext = (body: Body): string | null => {
  const gameId = body?.context?.gameId;
  return isValidId(gameId) ? gameId : null;
};

const toInt = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
};

const cleanText = (value: unknown, max: number): string =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim()
    .substring(0, max);

const sessionResponse = (user: UserDocument, currGameId: string | null) => ({
  id: user._id,
  userName: user.username,
  currGameId,
});

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

app.post("/api/createAccount", async (c) => {
  const body = await readBody(c);
  const email = String(body.email ?? "").toLowerCase().trim();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return validationError(c, "Email is not valid", "email");
  }
  if (!/^[A-Za-z0-9]{4,10}$/.test(username)) {
    return validationError(c, "Username missing", "username");
  }
  if (password.length === 0) {
    return validationError(c, "Password missing", "password");
  }
  if (password !== confirmPassword) {
    return validationError(c, "Passwords do not match", "confirmPassword");
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
    createdAt: now,
    updatedAt: now,
  };
  await users.create(user);

  await createSession(c, { id: user._id, userName: user.username });
  return c.json(sessionResponse(user, null));
});

const login = async (c: AppContext) => {
  const body = await readBody(c);
  // the login form sends the email in the "username" field
  const email = String(body.username ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return validationError(c, "Username missing", "username");
  }
  if (password.length === 0) {
    return validationError(c, "Password missing", "password");
  }

  const users = new UsersRepo(c.env.DB);
  const user = await users.findByEmail(email);
  if (!user || !(await verifyPassword(password, user.password))) {
    return c.text("Invalid username/password", 400);
  }

  if (isLegacyHash(user.password)) {
    // upgrade a bcrypt hash imported from the old database
    user.password = await hashPassword(password, pbkdf2Iterations(c.env));
    await users.save(user);
  }

  const currGameId = await resolveCurrentGame(c, users, user);
  await createSession(c, { id: user._id, userName: user.username });
  return c.json(sessionResponse(user, currGameId));
};
app.post("/api/login", login);
app.post("/api/logIn", login); // the React client calls this spelling

app.post("/api/logout", async (c) => {
  clearSession(c);
  return c.json({});
});

app.post("/api/current-session", async (c) => {
  const session = await getSession(c);
  if (!session) {
    return c.body(null, 401);
  }
  const users = new UsersRepo(c.env.DB);
  const user = await users.findById(session.id);
  if (!user) {
    clearSession(c);
    return c.body(null, 401);
  }
  const currGameId = await resolveCurrentGame(c, users, user);
  return c.json(sessionResponse(user, currGameId));
});

// ---------------------------------------------------------------------------
// lobby
// ---------------------------------------------------------------------------

app.post("/api/findGames", async (c) => {
  if (!(await requireUserId(c))) {
    return invalidAuth(c);
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const games = await new GamesIndexRepo(c.env.DB).listJoining(since);
  return c.json({ games });
});

app.post("/api/findPlayers", async (c) => {
  if (!(await requireUserId(c))) {
    return invalidAuth(c);
  }
  const users = await new UsersRepo(c.env.DB).listAll();
  const players: PlayerInfo[] = users.map((u) => ({
    playerId: u._id,
    name: u.username,
    wins: u.wins,
    gamesPlayed: u.gamesPlayed,
    currGame: u.currGameName,
  }));
  return c.json({ players });
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
  if (initialMoney == null || initialMoney < 0) {
    return validationError(c, "Starting amount is not valid", "data.initialMoney");
  }
  if (initialSkillPoints == null || initialSkillPoints < 0) {
    return validationError(c, "Initial Skill Points is not valid", "data.initialSkillPoints");
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
      password: data.gamePwd ? String(data.gamePwd) : null,
      useTimers: !!data.useTimers,
    },
    numBots,
    botLevel
  );

  return c.json({ gameId });
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
  if (!(await requireUserId(c))) {
    return invalidAuth(c);
  }
  const game = await roomFor(c, body.gameId).getGame();
  return c.json({ game });
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
  if (!(await requireUserId(c))) {
    return invalidAuth(c);
  }
  const gameId = gameIdFromContext(body);
  if (!gameId) {
    return c.text("missing gameId", 400);
  }
  const lotto = await roomFor(c, gameId).getLotto(body.lottoId);
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
    room.roll(userId, toInt(body.forceDie1), toInt(body.forceDie2))
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
