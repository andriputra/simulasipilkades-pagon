import postgres from "postgres";
import { LOCAL_DB, LOCAL_DATABASE_URL, readEnvFile, requireLocalDatabase } from "./config.mjs";

const LEGACY_TABLES = ["candidates", "voters", "votes", "audit_logs"];
const SERIAL_TABLES = new Set(LEGACY_TABLES);
const SOURCE_TABLES = ["settings", ...LEGACY_TABLES];
const PAGON_SLUG = "pilkades-pagon-2026";

const prodUrl = readEnvFile(".env.local").DATABASE_URL;
if (!prodUrl) throw new Error("DATABASE_URL produksi tidak ada di .env.local");
const targetUrl = process.env.TARGET_DATABASE_URL || LOCAL_DATABASE_URL;
if (!process.argv.includes("--allow-remote-target")) requireLocalDatabase(targetUrl, "db:snapshot");

const source = postgres(prodUrl, { max: 1, ssl: "require", connect_timeout: 15, onnotice: () => {} });
const target = postgres(targetUrl, { max: 1, onnotice: () => {} });

try {
  const role = await source`select current_user as role, (select rolsuper from pg_roles where rolname = current_user) as super,
                              (select rolbypassrls from pg_roles where rolname = current_user) as bypassrls,
                              version() as version`;
  console.log(`Sumber: role=${role[0].role} superuser=${role[0].super} bypassrls=${role[0].bypassrls}`);
  console.log(`Versi  : ${role[0].version}`);

  const columns = await source`
    select table_name, string_agg(column_name, ',' order by ordinal_position) as cols
    from information_schema.columns
    where table_schema = 'public' and table_name = any(${SOURCE_TABLES})
    group by table_name`;
  console.log("Struktur tabel sumber:");
  for (const c of columns) console.log(`  ${c.table_name}: ${c.cols}`);

  const migrated = !!(await target`select to_regclass('public.events') as t`)[0];
  const rows = {};
  for (const table of SOURCE_TABLES) rows[table] = await source`select * from ${source(table)}`;

  if (!migrated) {
    await target.unsafe(`truncate table votes, voters, candidates, audit_logs, settings cascade`);
    for (const table of SOURCE_TABLES) await load(table, rows[table], {});
    console.log("Mode skema warisan (pra-migrasi).");
  } else {
    const value = (key) => rows.settings.find((s) => s.key === key)?.value || "";
    const eventId = (
      await target`insert into events (slug, name, kind, status, vote_mode, is_default)
                    values (${PAGON_SLUG},
                            ${value("title_line1") || "Simulasi Pilkades"},
                            'pilkades',
                            ${value("election_status") === "closed" ? "closed" : "open"},
                            ${value("vote_mode") === "live" ? "live" : "simulasi"},
                            true)
                    on conflict (slug) do update set name = excluded.name, status = excluded.status, vote_mode = excluded.vote_mode
                    returning id`
    )[0].id;

    await target.begin(async (tx) => {
      const allEvents = await tx`select id from events`;

      // Id satu tabel dipakai bersama antar event, jadi id produksi bisa saja sudah
      // ditempati baris event lain di DB lokal. RLS memaksa pembacaan per scope.
      const usedByOthers = {};
      for (const table of LEGACY_TABLES) usedByOthers[table] = 0;
      for (const ev of allEvents) {
        if (ev.id === eventId) continue;
        await tx`select set_config('app.event_id', ${ev.id}::int::text, true)`;
        for (const table of LEGACY_TABLES) {
          const [row] = await tx`select coalesce(max(id), 0)::int as m from ${tx(table)}`;
          usedByOthers[table] = Math.max(usedByOthers[table], row.m);
        }
      }
      const shifted = Object.entries(usedByOthers).filter(([, v]) => v > 0);
      if (shifted.length) console.log("  id mirror digeser agar tidak tabrakan:", shifted.map(([t, v]) => `${t}+${v}`).join(" "));

      await tx`select set_config('app.event_id', ${eventId}::int::text, true)`;
      await tx`delete from votes where event_id = ${eventId}`;
      await tx`delete from voters where event_id = ${eventId}`;
      await tx`delete from candidates where event_id = ${eventId}`;
      await tx`delete from audit_logs where event_id = ${eventId}`;
      await tx`delete from event_settings where event_id = ${eventId}`;

      await loadInto(
        tx,
        "event_settings",
        rows.settings
          .filter((s) => s.key !== "election_status" && s.key !== "vote_mode")
          .map((s) => ({ event_id: eventId, key: s.key, value: s.value })),
      );
      for (const table of LEGACY_TABLES) {
        const off = usedByOthers[table];
        await loadInto(tx, table, rows[table].map((r) => ({
          ...r,
          event_id: eventId,
          id: r.id + off,
          ...(table === "votes"
            ? { voter_id: r.voter_id + usedByOthers.voters, candidate_id: r.candidate_id + usedByOthers.candidates }
            : {}),
        })));
      }
      await tx`update events set status = ${value("election_status") === "closed" ? "closed" : "open"},
                                  vote_mode = ${value("vote_mode") === "live" ? "live" : "simulasi"}
                where id = ${eventId}`;

      // Sequence dipakai bersama antar event: max harus dihitung lintas semua event
      // (baca tanpa scope akan disaring RLS dan memberi nilai 0).
      for (const table of LEGACY_TABLES) {
        let maxId = 0;
        for (const ev of allEvents) {
          await tx`select set_config('app.event_id', ${ev.id}::int::text, true)`;
          const [row] = await tx`select coalesce(max(id), 0)::int as m from ${tx(table)}`;
          maxId = Math.max(maxId, row.m);
        }
        await tx`select setval(pg_get_serial_sequence(${table}, 'id'), ${Math.max(maxId, 1)})`;
      }
    });

    console.log(`Mode skema multi-event: data produksi ditempel ke event "${PAGON_SLUG}" (id ${eventId}).`);
  }

  console.log("Snapshot dimuat ke lokal:", SOURCE_TABLES.map((t) => `${t}=${rows[t].length}`).join(" "));
  console.log(`DB lokal siap (role ${LOCAL_DB.appUser} non-superuser, RLS aktif). Password CMS lokal = hash dari produksi.`);
} finally {
  await source.end();
  await target.end();
}

async function load(table, data, extra) {
  await loadInto(target, table, data.map((r) => ({ ...r, ...extra })));
}

async function loadInto(sql, table, data) {
  for (let i = 0; i < data.length; i += 500) {
    const chunk = data.slice(i, i + 500);
    if (!chunk.length) continue;
    const cols = Object.keys(chunk[0]);
    await sql`insert into ${sql(table)} ${sql(chunk, cols)}`;
  }
}
