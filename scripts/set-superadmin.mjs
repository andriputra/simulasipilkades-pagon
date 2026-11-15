import crypto from "crypto";
import readline from "readline";
import postgres from "postgres";
import { LOCAL_DATABASE_URL, readEnvFile, requireLocalDatabase } from "./config.mjs";

const [username, displayName = ""] = process.argv.slice(2);
if (!username || !/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error("Pakai: npm run superadmin -- <username> [nama tampilan]");
  console.error("Username: 3–32 karakter, huruf kecil/angka/titik/garis bawah/tanda hubung.");
  console.error("Password dibaca dari stdin, mis. echo -ne 'rahasia123\\n' | npm run superadmin -- andri");
  process.exit(1);
}

const url = process.env.DATABASE_URL || readEnvFile(".env.development.local").DATABASE_URL || LOCAL_DATABASE_URL;
if (!process.argv.includes("--allow-remote")) requireLocalDatabase(url, "superadmin");

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
if (!password || password.length < 10) {
  console.error("Password akun platform minimal 10 karakter.");
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
const hash = `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;

const sql = postgres(url, { max: 1 });
try {
  const rows = await sql`
    insert into platform_users (username, name, password_hash)
    values (${username}, ${displayName}, ${hash})
    on conflict (username) do update set
      name = case when excluded.name = '' then platform_users.name else excluded.name end,
      password_hash = excluded.password_hash
    returning id, (xmax = 0) as dibuat_baru`;
  const row = rows[0];
  console.log(
    row.dibuat_baru
      ? `Akun platform "${username}" dibuat (id ${row.id}). Masuk di /platform/login.`
      : `Password akun platform "${username}" (id ${row.id}) diperbarui.`,
  );
  const dropped = await sql`
    update platform_sessions set revoked_at = now()
    where user_id = ${row.id} and revoked_at is null and expires_at > now()
    returning id`;
  if (dropped.length) console.log(`${dropped.length} sesi lama dicabut — masuk ulang diperlukan.`);
} finally {
  await sql.end();
}
