import type { Context } from "hono";
import { Env, isDevEnv } from "../env";
import { clientIp } from "./throttle";

type Ctx = Context<{ Bindings: Env }>;

// Cloudflare Turnstile: the sign-up form renders the widget, sends its token
// as `turnstileToken`, and the Worker redeems it with Siteverify before an
// account is created. Tokens are single-use and expire after five minutes.
//
// Local development uses Turnstile's published test keys (see
// worker/.dev.vars.example and the client's .env.development). Their
// Siteverify results carry metadata.result_with_testing_key and have no
// action and a placeholder hostname, so those two checks are skipped for test
// results in development only.

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;
/** Turnstile's published test secret that accepts every token */
const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

type SiteverifyResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
  metadata?: { result_with_testing_key?: boolean };
};

export type TurnstileOutcome =
  | { ok: true }
  /** the visitor should solve the challenge again */
  | { ok: false; reason: "missing" | "invalid" }
  /** the server cannot check tokens (no secret, Siteverify unreachable) */
  | { ok: false; reason: "unavailable" };

const expectedHostnames = (env: Env): Set<string> =>
  new Set(
    (env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  );

export const verifyTurnstile = async (c: Ctx, token: unknown, expectedAction: string): Promise<TurnstileOutcome> => {
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "missing" };
  }
  if (token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, reason: "invalid" };
  }

  const dev = isDevEnv(c.env);
  // development falls back to the always-pass test secret, so a .dev.vars
  // from before the bot check keeps working
  const secret = c.env.TURNSTILE_SECRET_KEY || (dev ? TEST_SECRET_KEY : undefined);
  const hostnames = expectedHostnames(c.env);
  if (!secret || (!dev && hostnames.size === 0)) {
    console.error("Turnstile is not configured: set the TURNSTILE_SECRET_KEY secret and TURNSTILE_HOSTNAMES");
    return { ok: false, reason: "unavailable" };
  }

  let result: SiteverifyResult;
  try {
    const form = new URLSearchParams({ secret, response: token });
    const ip = clientIp(c);
    if (ip !== "unknown") {
      form.set("remoteip", ip);
    }
    const r = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      throw new Error(`siteverify ${r.status}`);
    }
    result = await r.json();
  } catch (err) {
    // fail closed: no account without a verified token
    console.error("Turnstile siteverify failed", err);
    return { ok: false, reason: "unavailable" };
  }

  if (result.success !== true) {
    const codes = result["error-codes"] ?? [];
    if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) {
      console.error("Turnstile rejected the secret key", codes);
      return { ok: false, reason: "unavailable" };
    }
    return { ok: false, reason: "invalid" };
  }

  const testResult = dev && result.metadata?.result_with_testing_key === true;
  if (!testResult) {
    if (result.action !== expectedAction) {
      return { ok: false, reason: "invalid" };
    }
    if (hostnames.size > 0 && !hostnames.has((result.hostname ?? "").toLowerCase())) {
      return { ok: false, reason: "invalid" };
    }
  }
  return { ok: true };
};
