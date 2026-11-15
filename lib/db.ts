import postgres, { type Sql, type TransactionSql } from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL belum di-set. Untuk pengembangan lokal: npm run localdb && npm run migrate " +
      "(berkas .env.development.local yang dipakai).",
  );
}

const host = new URL(url).hostname;
const isLocal = host === "127.0.0.1" || host === "localhost" || host === "::1";

// Penanda mode development: satu basis data dipakai bersama oleh banyak simulasi,
// jadi pengembangan yang tidak sengaja menunjuk ke database produksi akan
// menulis data uji ke data klien yang sedang berjalan.
if (process.env.NODE_ENV === "development" && !isLocal && process.env.ALLOW_REMOTE_DB !== "1") {
  throw new Error(
    `Mode development menolak database jarak jauh (host: ${host}). ` +
      "Jalankan DB lokal (npm run localdb) atau set ALLOW_REMOTE_DB=1 bila memang disengaja.",
  );
}

const g = globalThis as unknown as { __pilkadesSql?: Sql };

export const sql: Sql =
  g.__pilkadesSql ??
  postgres(url, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") g.__pilkadesSql = sql;

export type EventTx = TransactionSql;

export type Candidate = {
  id: number;
  event_id: number;
  number: number;
  name: string;
  tagline: string;
  photo_url: string;
  active: boolean;
};

export type Voter = {
  id: number;
  event_id: number;
  name: string;
  nik: string;
  token: string;
  has_voted: boolean;
  voted_at: string | null;
  created_at: string;
};

export type AuditLog = {
  id: number;
  event_id: number;
  action: string;
  detail: string;
  actor: string;
  ip: string;
  created_at: string;
};

/**
 * Semua akses ke tabel per-event wajib lewat sini. Di dalam transaksi,
 * app.event_id di-set sehingga kebijakan row-level-security membatasi baris
 * yang bisa dibaca maupun ditulis ke satu event saja. Query yang lupa
 * menyaring event_id tidak akan bocor — ia hanya melihat baris event itu.
 */
export async function withEvent<T>(eventId: number, fn: (tx: EventTx) => Promise<T>): Promise<T> {
  const result = await sql.begin(async (tx) => {
    await tx`select set_config('app.event_id', ${eventId}::int::text, true)`;
    return fn(tx);
  });
  return result as unknown as T;
}

/**
 * Jalur konsol platform: baca (dan hapus) lintas simulasi.
 *
 * app.platform_admin di-set tanpa app.event_id, sehingga kebijakan RLS membuka
 * semua baris untuk SELECT/DELETE tetapi tetap menolak INSERT/UPDATE — penulis
 * data event wajib lewat withEvent(). Jangan pakai ini untuk membaca satu event
 * tertentu; denganEvent() lebih tepat karena ikut membatasi kecerobohan filter.
 */
export async function withPlatform<T>(fn: (tx: EventTx) => Promise<T>): Promise<T> {
  const result = await sql.begin(async (tx) => {
    await tx`select set_config('app.platform_admin', '1', true)`;
    return fn(tx);
  });
  return result as unknown as T;
}

export async function getEventSettings(eventId: number): Promise<Record<string, string>> {
  return withEvent(eventId, async (tx) => {
    const rows = await tx`select key, value from event_settings`;
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  });
}

export async function setEventSetting(eventId: number, key: string, value: string, tx?: EventTx): Promise<void> {
  const write = (q: EventTx) =>
    q`insert into event_settings (event_id, key, value) values (${eventId}, ${key}, ${value})
       on conflict (event_id, key) do update set value = excluded.value`;
  if (tx) {
    await write(tx);
    return;
  }
  await withEvent(eventId, write);
}
