import readline from "readline";
import postgres from "postgres";
import { LOCAL_DATABASE_URL, readEnvFile, requireLocalDatabase } from "./config.mjs";

const [slug, username = "admin"] = process.argv.slice(2);
if (!slug) {
  console.error("Pakai: npm run admin:password -- <slug-event> [username]");
  console.error("Password dibaca dari stdin, misalnya: echo -ne 'rahasia\\n' | npm run admin:password -- slug");
  process.exit(1);
}

const url = process.env.DATABASE_URL || readEnvFile(".env.development.local").DATABASE_URL || LOCAL_DATABASE_URL;
if (!process.argv.includes("--allow-remote")) requireLocalDatabase(url, "admin:password");

const password = await new Promise((resolve, reject) => {
  const rl = readline.createInterface({ input: process.stdin });
  let done = false;
  rl.on("line", (line) => {
    if (done) return;
    done = true;
    rl.close();
    resolve(line);
  });
  rl.on("close", () => !done && reject(new Error("Password tidak diterima dari stdin.")));
});
if (!password || password.length < 8) {
  console.error("Password minimal 8 karakter.");
  process.exit(1);
}

const crypto = await import("crypto");
const salt = crypto.randomBytes(16).toString("hex");
const hash = `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;

const sql = postgres(url, { max: 1 });
try {
  await sql.begin(async (tx) => {
    const [ev] = await tx`select id from events where slug = ${slug}`;
    if (!ev) throw new Error(`Event "${slug}" tidak ada. Buat lewat migrations/superadmin dulu.`);
    await tx`select set_config('app.event_id', ${ev.id}::int::text, true)`;
    await tx`insert into event_settings (event_id, key, value) values (${ev.id}, 'admin_username', ${username})
              on conflict (event_id, key) do update set value = excluded.value`;
    await tx`insert into event_settings (event_id, key, value) values (${ev.id}, 'admin_password_hash', ${hash})
              on conflict (event_id, key) do update set value = excluded.value`;
  });
  console.log(`Kredensial CMS event "${slug}" diset (username: ${username}).`);
} finally {
  await sql.end();
}
