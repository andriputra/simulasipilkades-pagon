// Skrip sementara untuk gladi resik cutover. Membuat DB lokal tiruan (pilkades_dryrun)
// yang meniru kondisi Neon produksi hari ini: skema warisan + data asli.
// Produksi HANYA dibaca (select). Tidak ada commit/push, tidak ada tulis ke Neon.
import fs from "fs";
import path from "path";
import postgres from "postgres";
import { ROOT, LOCAL_DB, readEnvFile } from "./config.mjs";

const DRY = "pilkades_dryrun";
const prodUrl = readEnvFile(".env.local").DATABASE_URL;
if (!prodUrl) throw new Error("DATABASE_URL produksi tidak ada di .env.local");
const superUrl = `postgresql://${LOCAL_DB.superUser}:${LOCAL_DB.superPassword}@127.0.0.1:${LOCAL_DB.port}/postgres`;
const dryUrl =
  `postgresql://${LOCAL_DB.appUser}:${LOCAL_DB.appPassword}@127.0.0.1:${LOCAL_DB.port}/${DRY}?sslmode=disable&connect_timeout=10`;

const admin = postgres(superUrl, { max: 1, onnotice: () => {} });
await admin.unsafe(`drop database if exists ${DRY}`);
await admin.unsafe(
  `create database ${DRY} with encoding 'UTF8' lc_collate 'C' lc_ctype 'C' template template0 owner "${LOCAL_DB.appUser}"`,
);
await admin.end();
console.log(`DB tiruan ${DRY} dibuat (owner ${LOCAL_DB.appUser}, non-BYPASSRLS seperti lokal).`);

const prod = postgres(prodUrl, { max: 1, ssl: "require", connect_timeout: 15, onnotice: () => {} });
const dry = postgres(dryUrl, { max: 1, onnotice: () => {} });

try {
  await dry.unsafe(fs.readFileSync(path.join(ROOT, "migrations", "0001_baseline_legacy_schema.sql"), "utf8"));
  console.log("Skema warisan dibuat dari 0001_baseline_legacy_schema.sql.");

  const TABLES = ["settings", "candidates", "voters", "votes", "audit_logs"];

  // Samakan struktur kolom: bandingkan katalog produksi vs tiruan.
  const cols = async (sql) =>
    sql`select table_name, column_name, data_type, is_nullable
        from information_schema.columns
        where table_schema = 'public' and table_name = any(${TABLES})
        order by table_name, ordinal_position`;
  const [pc, dc] = [await cols(prod), await cols(dry)];
  const key = (r) => `${r.table_name}.${r.column_name}:${r.data_type}`;
  const missingInDry = pc.map(key).filter((k) => !dc.map(key).includes(k));
  const extraInDry = dc.map(key).filter((k) => !pc.map(key).includes(k));
  console.log("Beda kolom prod vs tiruan → hilang:", missingInDry.join(" ") || "(tidak ada)", "| lebih:", extraInDry.join(" ") || "(tidak ada)");

  console.log("\nBaseline produksi (baca-saja):");
  const report = {};
  for (const t of TABLES) {
    if (t === "settings") {
      report[t] = await prod`select key, value from settings order by key`;
      console.log(`  settings: ${report[t].length} baris → ${report[t].map((s) => s.key).join(", ")}`);
      continue;
    }
    const [r] = await prod`select count(*)::int as n, coalesce(max(id), 0)::int as max_id from ${prod(t)}`;
    report[t] = await prod`select * from ${prod(t)} order by id`;
    console.log(`  ${t}: ${r.n} baris, max id ${r.max_id}`);
  }
  const [lastAudit] = await prod`select id, action, created_at from audit_logs order by id desc limit 1`;
  console.log(`  audit terakhir: #${lastAudit.id} ${lastAudit.action} @ ${lastAudit.created_at.toISOString()}`);
  const [st] = await prod`select key, value from settings where key in ('election_status','vote_mode') order by key`;
  console.log("  status:", JSON.stringify(Object.fromEntries(report.settings.map((s) => [s.key, s.value]))).slice(0, 400));

  for (const t of TABLES) {
    const data = report[t];
    for (let i = 0; i < data.length; i += 500) {
      const chunk = data.slice(i, i + 500);
      if (!chunk.length) continue;
      const colsIn = Object.keys(chunk[0]);
      await dry`insert into ${dry(t)} ${dry(chunk, colsIn)}`;
    }
    if (t !== "settings") await dry`select setval(pg_get_serial_sequence(${t}, 'id'), ${Math.max(data.at(-1)?.id ?? 1, 1)})`;
  }
  console.log("\nData produksi disalin ke tiruan. Kondisi awal cutover siap.");
  const [check] = await dry`select (select count(*) from voters) v, (select count(*) from votes) vs,
                              (select count(*) from candidates) c, (select count(*) from audit_logs) a,
                              (select count(*) from settings) s`;
  console.log("Cek tiruan:", JSON.stringify(check));
} finally {
  await prod.end();
  await dry.end();
}
