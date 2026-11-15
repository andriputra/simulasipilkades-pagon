import fs from "fs";
import path from "path";
import EmbeddedPostgres from "embedded-postgres";
import { ROOT, LOCAL_DB } from "./config.mjs";

const pg = new EmbeddedPostgres({
  databaseDir: path.join(ROOT, ".localdb", "data"),
  user: LOCAL_DB.superUser,
  password: LOCAL_DB.superPassword,
  port: LOCAL_DB.port,
  persistent: true,
  onLog: () => {},
  onError: (msg) => process.stderr.write(`[localdb] ${msg}`),
});

const cmd = process.argv[2] ?? "start";

if (cmd === "stop") {
  await pg.stop();
  console.log("Postgres lokal berhenti.");
  process.exit(0);
}

if (!fs.existsSync(path.join(ROOT, ".localdb", "data", "PG_VERSION"))) {
  console.log("Inisialisasi cluster Postgres lokal...");
  await pg.initialise();
}

await pg.start();

const client = pg.getPgClient();
await client.connect();
const [exists] = (await client.query("select 1 from pg_database where datname = $1", [LOCAL_DB.name])).rows;
if (!exists) {
  // initdb Windows memakai encoding ANSI (WIN1252), sehingga teks UTF-8 seperti
  // panah dan tanda baca Indonesia di audit log ditolak server (error 22P05).
  await client.query(
    `create database "${LOCAL_DB.name}" with encoding 'UTF8' lc_collate 'C' lc_ctype 'C' template template0`,
  );
}
const [enc] = (
  await client.query("select pg_encoding_to_char(encoding) as enc from pg_database where datname = $1", [LOCAL_DB.name])
).rows;
if (enc && enc.enc !== "UTF8") {
  await client.end();
  throw new Error(
    `Database "${LOCAL_DB.name}" ber-encoding ${enc.enc}. Buat ulang: drop database lalu npm run localdb:ensure.`,
  );
}
const [roleExists] = (await client.query("select 1 from pg_roles where rolname = $1", [LOCAL_DB.appUser])).rows;
if (!roleExists) {
  await client.query(`create role "${LOCAL_DB.appUser}" login password '${LOCAL_DB.appPassword}' nosuperuser nobypassrls nocreatedb nocreaterole`);
}
await client.query(`alter database "${LOCAL_DB.name}" owner to "${LOCAL_DB.appUser}"`);
await client.end();

console.log(`Postgres lokal siap di port ${LOCAL_DB.port} (db ${LOCAL_DB.name}, role ${LOCAL_DB.appUser}).`);

if (cmd === "ensure") {
  await pg.stop();
  process.exit(0);
}

process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});
console.log("Tekan Ctrl+C untuk menghentikan.");
setInterval(() => {}, 1 << 30);
