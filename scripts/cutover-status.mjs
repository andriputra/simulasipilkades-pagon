// Pemeriksaan kondisi basis data untuk cutover. HANYA MEMBACA (select), aman dijalankan
// berulang terhadap produksi maupun lokal.
// Pakai:
//   node scripts/cutover-status.mjs                      -> baca DATABASE_URL di .env.local (produksi)
//   node scripts/cutover-status.mjs --db <url>           -> target lain
//   node scripts/cutover-status.mjs --expect pasca-migrasi
import postgres from "postgres";
import { readEnvFile } from "./config.mjs";

const args = process.argv.slice(2);
const dbFlag = args.indexOf("--db");
const expectMigrated = args.includes("--expect");
const url = (dbFlag >= 0 ? args[dbFlag + 1] : null) || process.env.DATABASE_URL || readEnvFile(".env.local").DATABASE_URL;
if (!url) throw new Error("DATABASE_URL tidak ditemukan (env, --db, atau .env.local).");

const RISA = new Set(["admin_password_hash"]);
const sql = postgres(url, { max: 1, ssl: url.includes("127.0.0.1") || url.includes("localhost") ? undefined : "require", connect_timeout: 20, onnotice: () => {} });

try {
  const [who] = await sql`select current_user as role,
    coalesce((select rolsuper from pg_roles where rolname = current_user), false) as superuser,
    coalesce((select rolbypassrls from pg_roles where rolname = current_user), false) as bypassrls,
    current_database() as db, version() as versi`;
  console.log(`DB     : ${who.db} @ ${new URL(url).hostname}`);
  console.log(`Role   : ${who.role} superuser=${who.superuser} bypassrls=${who.bypassrls}${who.bypassrls ? "  <- RLS tidak menegasi role ini" : ""}`);
  console.log(`Versi  : ${who.versi.split(",")[0]}`);

  // Tanpa konteks ini, role non-BYPASSRLS (mis. pilkades_app di lokal) hanya melihat
  // nol baris karena RLS — bukan karena datanya hilang.
  await sql`select set_config('app.platform_admin', '1', false)`;

  const has = async (t) =>
    !!(await sql`select 1 from information_schema.tables where table_schema='public' and table_name=${t}`)[0];
  const tables = ["events", "event_settings", "platform_users", "platform_sessions", "settings", "platform_settings", "schema_migrations", "voters", "votes", "candidates", "audit_logs"];
  const present = {};
  for (const t of tables) present[t] = await has(t);
  console.log(`Skema  : ${present.events ? "MULTI-EVENT (sudah bermigrasi)" : "WARISAN (belum bermigrasi)"}`);
  console.log(`Tabel  : ${tables.filter((t) => present[t]).join(" ")}`);
  const applied = present.schema_migrations ? (await sql`select id from schema_migrations order by id`).map((r) => r.id) : [];
  if (applied.length) console.log(`Migrasi: ${applied.join(" ")}`);

  const countOf = async (t) => (present[t] ? (await sql.unsafe(`select count(*)::int as n from "${t}"`))[0].n : "-");
  const missing = present.events ? ["settings"] : ["events"];
  for (const t of ["events", "voters", "votes", "candidates", "audit_logs", "settings", "platform_settings", "platform_users"]) {
    if (present[t]) console.log(`  ${t.padEnd(18)} ${await countOf(t)} baris`);
  }

  if (present.settings) {
    const s = await sql`select key, value from settings order by key`;
    console.log(`Kunci settings: ${s.map((r) => (RISA.has(r.key) ? `${r.key}(len ${r.value.length})` : `${r.key}=${r.value}`.slice(0, 46))).join(" ")}`);
    const st = await sql`select key, value from settings where key in ('election_status','vote_mode') order by key`;
    console.log(`Status/mode   : ${st.map((r) => `${r.key}=${r.value}`).join(" ")}`);
  }
  if (present.events) {
    const ev = await sql`select id, slug, name, kind, status, vote_mode, is_default from events order by id`;
    for (const e of ev) console.log(`  event #${e.id} ${e.slug} [${e.kind}/${e.status}/${e.vote_mode}]${e.is_default ? " DEFAULT" : ""} "${e.name}"`);
    const nulls = await sql`
      select 'voters' t, count(*)::int n from voters where event_id is null
      union all select 'candidates', count(*)::int from candidates where event_id is null
      union all select 'votes', count(*)::int from votes where event_id is null
      union all select 'audit_logs', count(*)::int from audit_logs where event_id is null`;
    const buruk = nulls.filter((r) => r.n > 0);
    console.log(`Baris tanpa event_id: ${nulls.map((r) => `${r.t}=${r.n}`).join(" ")} ${buruk.length ? "<- PERLU DIISI ULANG" : "(bersih)"}`);
  }

  if (present.voters) {
    const [ix] = await sql`select count(*)::int as n from pg_indexes where schemaname='public' and tablename='voters' and indexname='voters_event_token_uniq'`;
    console.log(`Indeks unik per-event (voters): ${ix.n ? "ada" : "belum ada"}`);
  }
  const [last] = await sql`select id, action, created_at from audit_logs order by id desc limit 1`;
  console.log(last
    ? `Audit terakhir: #${last.id} ${last.action} @ ${new Date(last.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`
    : "Audit terakhir: (tidak terlihat — cek konteks RLS role ini)");
  const [rls] = await sql`select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace
                          where n.nspname='public' and c.relrowsecurity and c.relname = any('{voters,votes,candidates,audit_logs,event_settings}')`;
  console.log(`Tabel dengan RLS aktif: ${rls.n}/5`);

  if (expectMigrated && !present.events) {
    console.log("\nHASIL: diharapkan skema multi-event, tetapi basis data masih warisan.");
    process.exitCode = 1;
  }
} finally {
  await sql.end();
}
