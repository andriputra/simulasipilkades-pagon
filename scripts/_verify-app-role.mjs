import fs from "fs";
import path from "path";
import postgres from "postgres";
import { ROOT } from "./config.mjs";

const url = fs.readFileSync(path.join(ROOT, ".sandi-dsn-pilkades-app.txt"), "utf8").trim();
const sql = postgres(url, { max: 1, connect_timeout: 20, onnotice: () => {} });

// Meniru lib/db.ts: GUC selalu local:true di dalam transaksi, jadi tidak pernah bocor ke sesi.
const asEvent = (eventId, fn) =>
  sql.begin(async (tx) => {
    await tx`select set_config('app.event_id', ${String(eventId)}, true)`;
    return fn(tx);
  });
const asPlatform = (fn) =>
  sql.begin(async (tx) => {
    await tx`select set_config('app.platform_admin', '1', true)`;
    return fn(tx);
  });

try {
  const who = await sql`select current_user as role,
    (select rolsuper from pg_roles where rolname=current_user) as super,
    (select rolbypassrls from pg_roles where rolname=current_user) as bypassrls`;
  console.log("identitas   :", JSON.stringify(who[0]));

  // Pooler Neon bisa mengembalikan backend yang sama: bersihkan GUC yang mungkin tertinggal sesi lama.
  await sql`select set_config('app.event_id','',false), set_config('app.platform_admin','',false)`;
  const baseline = await sql`select case when current_setting('app.event_id',true) is null then 'NULL'
                                         when current_setting('app.event_id',true) = '' then '(kosong)'
                                         else current_setting('app.event_id',true) end as ev,
                             case when current_setting('app.platform_admin',true) is null then 'NULL'
                                  when current_setting('app.platform_admin',true) = '' then '(kosong)'
                                  else current_setting('app.platform_admin',true) end as plat`;
  console.log("baseline    : app.event_id='" + baseline[0].ev + "' app.platform_admin='" + baseline[0].plat + "'");

  console.log("tanpa GUC   : voters =", (await sql`select count(*)::int as n from voters`)[0].n, "(harus 0)");

  for (const ev of [1, 2]) {
    const r = await asEvent(ev, (tx) => tx`
      select (select count(*)::int from voters) as pemilih,
             (select count(*)::int from voters where has_voted) as sudah_coblos,
             (select count(*)::int from candidates) as calon,
             (select count(*)::int from votes) as suara,
             (select count(*)::int from audit_logs) as audit,
             (select count(*)::int from event_settings) as pengaturan`);
    console.log(`event ${ev}     :`, JSON.stringify(r[0]));
  }

  const plat = await asPlatform((tx) => tx`
    select (select count(*)::int from voters) as voters,
           (select count(*)::int from events) as events,
           (select count(*)::int from platform_users) as admins,
           (select count(*)::int from schema_migrations) as migrasi`);
  console.log("platform    :", JSON.stringify(plat[0]));

  // Bahaya lama: "Reset suara" di satu event ikut menyapu event lain. Semua dibatalkan.
  const ROLLBACK = "__sengaja-batal__";
  const batal = async (fn) => {
    try {
      await sql.begin(async (tx) => {
        await fn(tx);
        throw new Error(ROLLBACK);
      });
    } catch (e) {
      if (e.message !== ROLLBACK) throw e;
    }
  };

  for (const ev of [2, 1]) {
    await batal(async (tx) => {
      await tx`select set_config('app.event_id', ${String(ev)}, true)`;
      const del = await tx`delete from votes returning id`;
      const upd = await tx`update voters set has_voted = false, voted_at = null where has_voted returning id`;
      const terlihat = await tx`select count(*)::int as n from voters`;
      console.log(`reset-votes event ${ev}: suara terhapus=${del.length} pemilih ternormalisasi=${upd.length} (dari ${terlihat[0].n} yang terlihat) — dibatalkan`);
    });
  }

  await batal(async (tx) => {
    await tx`select set_config('app.event_id', '1', true)`;
    const ok = await tx`insert into audit_logs (event_id, action, detail, actor) values (1, 'UJI_RLS', 'tmp', 'skrip') returning id`;
    console.log("tulis scoped: event_id=1 saat GUC=1 diterima (id", ok[0].id, ") — dibatalkan");
  });
  try {
    await sql.begin(async (tx) => {
      await tx`select set_config('app.event_id', '1', true)`;
      await tx`insert into audit_logs (event_id, action, detail, actor) values (2, 'UJI_RLS', 'tmp', 'skrip')`;
      return tx;
    });
    console.log("tulis lintas: DITERIMA — with check tidak bekerja, ini cacat");
  } catch (e) {
    console.log("tulis lintas: ditolak server sesuai harapan →", String(e.message).split("\n")[0]);
  }

  const residu = await asPlatform((tx) => tx`select count(*)::int as n from audit_logs where action='UJI_RLS'`);
  console.log("residu uji  :", residu[0].n, "(harus 0)");
} finally {
  await sql.end();
}
