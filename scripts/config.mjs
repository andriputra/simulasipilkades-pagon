import fs from "fs";
import path from "path";

export const ROOT = path.resolve(import.meta.dirname, "..");

export const LOCAL_DB = {
  name: "pilkades_dev",
  port: 54329,
  appUser: "pilkades_app",
  appPassword: "pilkades_app_dev",
  superUser: "postgres",
  superPassword: "postgres_local",
};

export const LOCAL_DATABASE_URL =
  `postgresql://${LOCAL_DB.appUser}:${LOCAL_DB.appPassword}@127.0.0.1:${LOCAL_DB.port}/${LOCAL_DB.name}` +
  `?sslmode=disable&connect_timeout=10`;

export function readEnvFile(name) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function isLocalDatabase(url) {
  const host = new URL(url).hostname;
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function requireLocalDatabase(url, what) {
  if (!isLocalDatabase(url)) {
    throw new Error(`${what} hanya boleh berjalan terhadap Postgres lokal. Host saat ini: ${new URL(url).hostname}`);
  }
}
