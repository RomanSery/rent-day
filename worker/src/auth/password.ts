import bcrypt from "bcryptjs";

// New hashes: PBKDF2-SHA256 via Web Crypto, stored as
//   pbkdf2$<iterations>$<salt hex>$<hash hex>
// Legacy hashes from the Mongo database ($2a$... bcrypt) are still verified
// with bcryptjs and upgraded on the next successful login.

const PREFIX = "pbkdf2";
export const DEFAULT_ITERATIONS = 100000;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
};

const derive = async (
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
};

const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
};

export const hashPassword = async (
  password: string,
  iterations: number = DEFAULT_ITERATIONS
): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return [PREFIX, iterations, toHex(salt), toHex(hash)].join("$");
};

export const isLegacyHash = (stored: string): boolean =>
  stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$");

export const verifyPassword = async (
  password: string,
  stored: string | null | undefined
): Promise<boolean> => {
  if (!stored || !password) {
    return false;
  }

  if (stored.startsWith(PREFIX + "$")) {
    const [, iterStr, saltHex, hashHex] = stored.split("$");
    const iterations = parseInt(iterStr, 10);
    if (!iterations || !saltHex || !hashHex) {
      return false;
    }
    const actual = await derive(password, fromHex(saltHex), iterations);
    return constantTimeEqual(actual, fromHex(hashHex));
  }

  if (isLegacyHash(stored)) {
    try {
      return await bcrypt.compare(password, stored);
    } catch (e) {
      console.log("legacy password check failed", e);
      return false;
    }
  }

  return false;
};
