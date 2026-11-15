import { randomInt } from "crypto";
import { DEFAULT_TOKEN_PREFIX } from "./event";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBlock(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function normalizePrefix(prefix: string | undefined | null): string {
  const clean = (prefix || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return clean || DEFAULT_TOKEN_PREFIX;
}

export function generateToken(prefix?: string | null): string {
  return `${normalizePrefix(prefix)}-${randomBlock(4)}-${randomBlock(4)}`;
}
