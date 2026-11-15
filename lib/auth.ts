import crypto from "crypto";
import { cookies } from "next/headers";

/** Nilai mentah sebuah cookie, untuk dicocokkan dengan penanda sesi di basis data. */
export async function cookieValue(name: string): Promise<string> {
  const store = await cookies();
  return store.get(name)?.value ?? "";
}

/** Sidik jari SHA-256 hex, untuk menyimpan token/session id tanpa menyimpan aslinya. */
export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET wajib di-set (token sesi ditandatangani dengannya).");
  return s;
}

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
  return crypto.createHmac("sha256", secret()).update(body).digest("hex");
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
