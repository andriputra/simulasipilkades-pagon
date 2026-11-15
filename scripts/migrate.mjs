import fs from "fs";
import path from "path";
import postgres from "postgres";
import { ROOT, LOCAL_DATABASE_URL, readEnvFile, requireLocalDatabase } from "./config.mjs";

const url = process.env.DATABASE_URL || readEnvFile(".env.development.local").DATABASE_URL || LOCAL_DATABASE_URL;
if (!process.argv.includes("--allow-remote")) requireLocalDatabase(url, "migrate");

const dir = path.join(ROOT, "migrations");
const untilIndex = process.argv.indexOf("--until");
const until = untilIndex >= 0 ? process.argv[untilIndex + 1] : null;
const files = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().filter((f) => !until || f <= until)
  : [];

const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql`create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`;
const done = new Set((await sql`select id from schema_migrations`).map((r) => r.id));

let applied = 0;
for (const file of files) {
  if (done.has(file)) continue;
  const text = fs.readFileSync(path.join(dir, file), "utf8");
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into schema_migrations (id) values (${file})`;
    });
    console.log(`+ ${file}`);
    applied++;
  } catch (err) {
    console.error(`! ${file} gagal: ${err.message}`);
    process.exitCode = 1;
    break;
  }
}

console.log(applied ? `${applied} migrasi diterapkan.` : "Tidak ada migrasi baru.");
await sql.end();
