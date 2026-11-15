// Verifikasi hasil gladi resik (DB tiruan saja).
import postgres from "postgres";
import { LOCAL_DB } from "./config.mjs";

const url = `postgresql://${LOCAL_DB.appUser}:${LOCAL_DB.appPassword}@127.0.0.1:${LOCAL_DB.port}/pilkades_dryrun?sslmode=disable&connect_timeout=10`;
const sql = postgres(url, { max: 1, onnotice: () => {} });

// Konteks pembacaan lintas event (sama seperti helper withPlatform di aplikasi).
await sql`select set_config('app.platform_admin', '1', false), set_config('app.event_id', '', false)`;

const [ev] = await sql`select id, slug, name, kind, status, vote_mode, is_default from events order by id`;
console.log("events:", JSON.stringify(ev));
const [n] = await sql`select count(*)::int as n from event_settings where event_id = ${ev.id}`;
console.log("event_settings utk event 1:", n.n, "baris");
const es = await sql`select key, length(value) as len from event_settings where event_id = ${ev.id} and key in ('admin_username','invite_address','title_line1','admin_password_hash') order by key`;
console.log("  kunci:", es.map((r) => `${r.key}(${r.len})`).join(" "));

const nulls = await sql`
  select 'voters' t, count(*)::int n from voters where event_id is null
  union all select 'candidates', count(*)::int from candidates where event_id is null
  union all select 'votes', count(*)::int from votes where event_id is null
  union all select 'audit_logs', count(*)::int from audit_logs where event_id is null`;
console.log("Baris tanpa event_id (harus 0 semua):", nulls.map((r) => `${r.t}=${r.n}`).join(" "));

const counts = await sql`select
  (select count(*) from voters where event_id = 1) v,
  (select count(*) from votes where event_id = 1) vs,
  (select count(*) from candidates where event_id = 1) c,
  (select count(*) from audit_logs where event_id = 1) a`;
console.log("Hitungan pasca-migrasi (konteks platform, target 15/2/4/383):", JSON.stringify(counts[0]));
const [legacy] = await sql`select to_regclass('public.settings') as s, to_regclass('public.platform_settings') as p`;
console.log("Tabel settings →", legacy.s, "| platform_settings →", legacy.p);
const left = await sql`select key from platform_settings order by key`;
console.log("Sisa baris platform_settings:", left.map((r) => r.key).join(", ") || "(kosong)");
const [mig] = await sql`select count(*)::int as n from audit_logs where action = 'MIGRATION_TENANCY'`;
console.log("Audit MIGRATION_TENANCY:", mig.n);
const integrity = await sql`
  select (select count(*) from votes vs join voters vo on vo.id = vs.voter_id and vo.event_id = vs.event_id) suara_cocok,
         (select count(*) from voters where has_voted and event_id = 1) flag_sudah_coblos,
         (select count(*) from votes where candidate_id not in (select id from candidates where event_id = 1)) kandidat_luar`;
console.log("Integritas:", JSON.stringify(integrity[0]));
const recap = await sql`select c.number, c.name, count(v.id)::int as suara from candidates c
                        left join votes v on v.candidate_id = c.id and v.event_id = c.event_id
                        where c.event_id = 1 group by c.id order by c.number`;
console.log("Rekap suara event 1:", recap.map((r) => `${r.number}.${r.name}=${r.suara}`).join(" "));

// Uji isolasi: koneksi aplikasi tanpa konteks harus buta.
await sql`select set_config('app.platform_admin', '', false), set_config('app.event_id', '', false)`;
const [without] = await sql`select count(*)::int as n from voters`;
console.log("\nRLS — SELECT tanpa app.event_id (harus 0):", without.n);
await sql`select set_config('app.event_id', '1', false)`;
const [scoped] = await sql`select count(*)::int as n from voters`;
console.log("RLS — SELECT dgn app.event_id=1:", scoped.n);
await sql`select set_config('app.event_id', '999', false)`;
const [other] = await sql`select count(*)::int as n from voters`;
console.log("RLS — SELECT dgn app.event_id=999 (harus 0):", other.n);
await sql`select set_config('app.platform_admin', '1', false)`;
const [seq] = await sql`select last_value::int as v from voters_id_seq`;
console.log("Sequence voters_id_seq:", seq.v, "(pemilih baru tidak boleh tabrakan id)");
const [plat] = await sql`select count(*)::int as n from platform_users`;
console.log("platform_users:", plat[0].n, "(0 = superadmin produksi belum dibuat)");
await sql.end();
