import crypto from "crypto";
import fs from "fs";
import path from "path";
import postgres from "postgres";
import { ROOT, readEnvFile } from "./config.mjs";

const APP_USER = "pilkades_app";
const ownerUrl = readEnvFile(".env.local").DATABASE_URL;
if (!ownerUrl) throw new Error("DATABASE_URL produksi tidak ada di .env.local");
console.log("sumber (owner):", new URL(ownerUrl).host, "| db:", new URL(ownerUrl).pathname.slice(1));

const sql = postgres(ownerUrl, { max: 1, ssl: "require", connect_timeout: 20, onnotice: () => {} });

// DDL tidak menerima parameter: identifier dikutip manual, dijalankan lewat unsafe().
const ident = `"${APP_USER.replace(/"/g, '""')}"`;
const ddl = (text) => sql.unsafe(text);

try {
  const [role] = await sql`select rolname, rolbypassrls, rolsuper, rolcanlogin from pg_roles where rolname = ${APP_USER}`;
  let password;
  if (role) {
    console.log(`role ${APP_USER} sudah ada (bypassrls=${role.rolbypassrls}) — hak pakainya disinkronkan ulang.`);
    password = null;
  } else {
    password = crypto.randomBytes(18).toString("base64url").replace(/[^A-Za-z0-9]/g, "") || crypto.randomBytes(16).toString("hex");
    const lit = `'${password.replace(/'/g, "''")}'`;
    await ddl(`create role ${ident} login password ${lit} nosuperuser nocreatedb nocreaterole nobypassrls noinherit`);
    console.log(`role ${APP_USER} dibuat (nobypassrls, sandi acak ${password.length} karakter — tidak ditampilkan).`);
  }

  await ddl(`grant usage on schema public to ${ident}`);
  await ddl(`grant select, insert, update, delete on all tables in schema public to ${ident}`);
  await ddl(`grant usage, select, update on all sequences in schema public to ${ident}`);
  // Tabel/sequence baru hasil migrasi berikutnya otomatis ikut ter-grant.
  await ddl(`alter default privileges in schema public grant select, insert, update, delete on tables to ${ident}`);
  await ddl(`alter default privileges in schema public grant usage, select, update on sequences to ${ident}`);
  console.log("grant: usage schema public + DML semua tabel + sequence + default privileges aktif.");

  const attrs = await sql`select rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls, rolcanlogin from pg_roles where rolname = ${APP_USER}`;
  console.log("atribut:", JSON.stringify(attrs[0]));

  const tables = await sql`
    select c.relname as t, has_table_privilege(${APP_USER}, c.oid, 'SELECT') as sel,
           has_table_privilege(${APP_USER}, c.oid, 'INSERT') as ins,
           has_table_privilege(${APP_USER}, c.oid, 'UPDATE') as upd,
           has_table_privilege(${APP_USER}, c.oid, 'DELETE') as del, relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' order by 1`;
  for (const r of tables) console.log(`  ${r.t}: sel=${r.sel} ins=${r.ins} upd=${r.upd} del=${r.del} rls=${r.rls}`);

  if (password) {
    const dsn = new URL(ownerUrl);
    dsn.username = APP_USER;
    dsn.password = password;
    const file = path.join(ROOT, ".sandi-dsn-pilkades-app.txt");
    fs.writeFileSync(file, dsn.toString() + "\n", { mode: 0o600 });
    console.log(`DSN role baru ditulis ke ${path.basename(file)} (file ini di-gitignore, jangan di-commit).`);
  } else {
    console.log("role sudah ada sebelumnya — sandi lama tidak diubah, pakai DSN lama untuk verifikasi.");
  }
} finally {
  await sql.end();
}
