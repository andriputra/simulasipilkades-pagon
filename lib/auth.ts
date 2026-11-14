import crypto from "crypto";

const SECRET = process.env.SESSION_SECRET || "pilkades-simulasi-dev-secret-ganti-saat-deploy";

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const calc = crypto.scryptSync(pw, salt, 64);
    const expect = Buffer.from(hash, "hex");
    return calc.length === expect.length && crypto.timingSafeEqual(calc, expect);
  } catch {
    return false;
  }
}

function hmac(body: string): string {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

export function makeToken(payload: string, ttlSeconds: number): string {
  const exp = Date.now() + ttlSeconds * 1000;
  const body = `${payload}.${exp}`;
  return `${body}.${hmac(body)}`;
}

export function verifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [payload, exp, sig] = parts;
  const body = `${payload}.${exp}`;
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(hmac(body), "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null;
  return payload;
}
