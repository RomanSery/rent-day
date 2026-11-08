import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { Env, isDevEnv } from "../env";

export const SESSION_COOKIE = "rentday_session";
const SESSION_DAYS = 30;

export interface SessionPayload {
  id: string;
  userName: string;
}

type Ctx = Context<{ Bindings: Env }>;

export const createSession = async (
  c: Ctx,
  payload: SessionPayload
): Promise<void> => {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const token = await sign({ ...payload, exp }, c.env.JWT_SECRET);

  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !isDevEnv(c.env),
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
};

export const clearSession = (c: Ctx): void => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
};

export const getSession = async (c: Ctx): Promise<SessionPayload | null> => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    return null;
  }
  try {
    const decoded = (await verify(token, c.env.JWT_SECRET, "HS256")) as Record<string, unknown>;
    if (decoded && typeof decoded.id === "string") {
      return {
        id: decoded.id,
        userName: typeof decoded.userName === "string" ? decoded.userName : "",
      };
    }
  } catch (e) {
    // expired or tampered token
  }
  return null;
};
