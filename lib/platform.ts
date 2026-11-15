import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PLATFORM_COOKIE, PLATFORM_SESSION_TTL, platformCookieOpts } from "./admin";
import { hashPassword, sha256, verifyPassword } from "./auth";
import { sql, setEventSetting, withEvent, withPlatform, type EventTx } from "./db";
import {
  EVENT_KINDS,
  EVENT_STATUSES,
  EVENT_VOTE_MODES,
  findEventBySlug,
  isValidSlug,
  parseWibInput,
  type EventRow,
} from "./event";
import { HttpError, json } from "./http";
import { clearRateLimit, isRateLimited } from "./rate-limit";

export type PlatformUser = { id: number; username: string; name: string };
export type PlatformSession = { id: number; user: PlatformUser };

// ---------------------------------------------------------------------------
// Sesi konsol
// ---------------------------------------------------------------------------

async function sessionToken(): Promise<string> {
  return (await cookies()).get(PLATFORM_COOKIE)?.value ?? "";
}

export async function startPlatformSession(user: PlatformUser, ip: string, userAgent: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await sql`
    insert into platform_sessions (user_id, token_hash, ip, user_agent, expires_at)
    values (${user.id}, ${sha256(token)}, ${ip}, ${userAgent.slice(0, 300)},
            now() + make_interval(secs => ${PLATFORM_SESSION_TTL}))`;
  return token;
}

export async function getPlatformSession(): Promise<PlatformSession | null> {
  const token = await sessionToken();
  if (!token) return null;
  const rows = await sql`
    select s.id, s.user_id, u.username, u.name
    from platform_sessions s
    join platform_users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.revoked_at is null and s.expires_at > now()`;
  const row = rows[0] as { id: number; user_id: number; username: string; name: string } | undefined;
  if (!row) return null;
  await sql`update platform_sessions set last_seen_at = now() where id = ${row.id}`;
  return { id: row.id, user: { id: row.user_id, username: row.username, name: row.name } };
}

export async function requirePlatformSession(): Promise<PlatformSession> {
  const session = await getPlatformSession();
  if (!session) throw new HttpError(401, "Masuk dulu ke konsol platform.");
  return session;
}

export async function endPlatformSession(): Promise<void> {
  const token = await sessionToken();
  if (!token) return;
  await sql`update platform_sessions set revoked_at = now() where token_hash = ${sha256(token)}`;
}

type PlatformCtx = { params: Promise<Record<string, string>> };
type PlatformHandler = (session: PlatformSession, req: Request, ctx: PlatformCtx) => Promise<NextResponse>;

/** Pembungkus API konsol — padanan adminRoute() untuk sesi platform. */
export function platformRoute(handler: PlatformHandler) {
  return async (req: Request, ctx: PlatformCtx) => {
    try {
      const session = await requirePlatformSession();
      return await handler(session, req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      throw err;
    }
  };
}

/** Semua API konsol memakai pola: baca slug dari path, lalu aksi. */
type SlugCtx = { params: Promise<{ slug: string }> };

async function eventOfCtx(ctx: SlugCtx): Promise<EventRow> {
  return findEventForPlatform((await ctx.params).slug);
}

/** Pembungkus API konsol yang bekerja pada satu simulasi. */
export function platformEventRoute(handler: (session: PlatformSession, ev: EventRow, req: Request) => Promise<NextResponse>) {
  return async (req: Request, ctx: SlugCtx) => {
    try {
      const session = await requirePlatformSession();
      const ev = await eventOfCtx(ctx);
      return await handler(session, ev, req);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      throw err;
    }
  };
}

export async function platformAudit(
  actor: string,
  action: string,
  detail: string,
  eventId: number | null,
  ip: string,
  /** Transaksi milik pemanggil: audit ikut gagal bila mutasinya gagal, begitu pula sebaliknya. */
  tx?: EventTx,
): Promise<void> {
  const q = tx ?? (sql as unknown as EventTx);
  await q`
    insert into platform_audit (actor, action, detail, event_id, ip)
    values (${actor}, ${action}, ${detail}, ${eventId}, ${ip})`;
}

export async function loginPlatform(
  username: string,
  password: string,
  ip: string,
  userAgent: string,
): Promise<{ user: PlatformUser; token: string }> {
  if (isRateLimited(`platform:${ip}`, 8)) {
    await platformAudit("anon", "LOGIN_RATE_LIMITED", `Terlalu banyak percobaan masuk konsol dari ${ip}`, null, ip);
    throw new HttpError(429, "Terlalu sering mencoba. Tunggu sekitar 15 menit lalu coba lagi.");
  }
  const rows = await sql`
    select id, username, name, password_hash from platform_users where username = ${username.trim()} limit 1`;
  const row = rows[0] as (PlatformUser & { password_hash: string }) | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    await platformAudit("anon", "LOGIN_FAILED", `Percobaan masuk konsol gagal untuk "${username.trim()}"`, null, ip);
    throw new HttpError(401, "Username atau password salah.");
  }
  clearRateLimit(`platform:${ip}`);
  const user: PlatformUser = { id: row.id, username: row.username, name: row.name };
  await sql`update platform_users set last_login_at = now() where id = ${user.id}`;
  await platformAudit(user.username, "LOGIN", `${user.name || user.username} masuk konsol platform`, null, ip);
  return { user, token: await startPlatformSession(user, ip, userAgent) };
}

// ---------------------------------------------------------------------------
// Simulasi (event)
// ---------------------------------------------------------------------------

export type EventSummary = EventRow & {
  voters: number;
  voted: number;
  candidates: number;
  votes: number;
};

/** Query ringkasan per simulasi. Dipakai daftar konsol dan rekap lintas simulasi
 *  agar kedua halaman tidak bisa menampilkan angka yang berbeda. */
function summaryRows(tx: EventTx) {
  return tx`
      select e.id, e.slug, e.name, e.kind, e.status, e.vote_mode, e.opens_at, e.closes_at,
             e.is_default, e.archived_at, e.created_at,
             cast((select count(*) from voters v where v.event_id = e.id) as int) as voters,
             cast((select count(*) from voters v where v.event_id = e.id and v.has_voted) as int) as voted,
             cast((select count(*) from candidates c where c.event_id = e.id and c.active) as int) as candidates,
             cast((select count(*) from votes s where s.event_id = e.id) as int) as votes
      from events e
      order by e.is_default desc, e.created_at desc`;
}

export async function listEventSummaries(): Promise<EventSummary[]> {
  return withPlatform(async (tx) => (await summaryRows(tx)) as unknown as EventSummary[]);
}

export type RecapOption = { number: number; name: string; active: boolean; votes: number };
export type EventRecap = EventSummary & { options: RecapOption[] };

/** Rekap semua simulasi sekali jalan: ringkasan + perolehan suara tiap opsi,
 *  diambil dalam satu transaksi jalur platform. */
export async function listEventRecaps(): Promise<EventRecap[]> {
  return withPlatform(async (tx) => {
    const events = (await summaryRows(tx)) as unknown as EventSummary[];
    const rows = (await tx`
      select c.event_id, c.number, c.name, c.active, cast(count(v.id) as int) as votes
      from candidates c
      left join votes v on v.candidate_id = c.id
      group by c.id, c.event_id, c.number, c.name, c.active
      order by c.event_id, c.number`) as unknown as (RecapOption & { event_id: number })[];

    const byEvent = new Map<number, RecapOption[]>();
    for (const r of rows) {
      const list = byEvent.get(r.event_id) ?? [];
      list.push({ number: r.number, name: r.name, active: r.active, votes: r.votes });
      byEvent.set(r.event_id, list);
    }
    return events.map((e) => ({ ...e, options: byEvent.get(e.id) ?? [] }));
  });
}

/** Angka satu simulasi untuk panel detail — lewat withEvent, bukan jalur platform. */
export async function getEventStats(eventId: number) {
  return withEvent(eventId, async (tx) => {
    const rows = await tx`
      select (select count(*)::int from voters) as voters,
             (select count(*)::int from voters where has_voted) as voted,
             (select count(*)::int from candidates) as candidates,
             (select count(*)::int from candidates where active) as candidates_active,
             (select count(*)::int from votes) as votes,
             (select count(*)::int from audit_logs) as audit`;
    return rows[0] as {
      voters: number;
      voted: number;
      candidates: number;
      candidates_active: number;
      votes: number;
      audit: number;
    };
  });
}

export type RecapFilter = { kind: string; status: string; cari: string };

/** Saring rekap lintas simulasi — dipakai halaman konsol dan ekspor CSV supaya
 *  berkas yang diunduh selalu berisi baris yang sama dengan yang tampil di layar. */
export function filterRecaps(rows: EventRecap[], f: RecapFilter): EventRecap[] {
  const q = f.cari.toLowerCase();
  return rows.filter(
    (e) =>
      (!f.kind || e.kind === f.kind) &&
      (!f.status || e.status === f.status) &&
      (!q || e.name.toLowerCase().includes(q) || e.slug.includes(q)),
  );
}

export async function findEventForPlatform(slug: string): Promise<EventRow> {
  const ev = await findEventBySlug(slug);
  if (!ev) throw new HttpError(404, "Simulasi tidak ditemukan.");
  return ev;
}

const NAME_RE = /^[\p{L}\p{N}\p{P}\p{Zs}]{3,80}$/u;
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

/** Jadwal dibaca sebagai waktu Jakarta (aplikasi ini dipakai di Indonesia). */
export function parseWibDateTime(value: string): Date | null {
  const d = parseWibInput(value);
  if (d === "invalid") throw new HttpError(400, "Format jadwal tidak dikenal (contoh: 2026-11-20T08:00).");
  return d;
}

export type EventDraft = {
  name?: string;
  kind?: string;
  status?: string;
  vote_mode?: string;
  opens_at?: string;
  closes_at?: string;
};

function validateDraft(draft: EventDraft) {
  const name = (draft.name || "").trim();
  if (!NAME_RE.test(name)) throw new HttpError(400, "Nama simulasi 3–80 karakter.");
  const kind = draft.kind || "pilkades";
  if (!(EVENT_KINDS as readonly string[]).includes(kind)) throw new HttpError(400, "Jenis pemilihan tidak dikenal.");
  const status = draft.status || "draft";
  if (!(EVENT_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, "Status tidak dikenal.");
  const vote_mode = draft.vote_mode || "simulasi";
  if (!(EVENT_VOTE_MODES as readonly string[]).includes(vote_mode)) throw new HttpError(400, "Mode pemungutan suara tidak dikenal.");
  const opens = parseWibDateTime(draft.opens_at || "");
  const closes = parseWibDateTime(draft.closes_at || "");
  if (opens && closes && closes <= opens) throw new HttpError(400, "Jam tutup harus setelah jam buka.");
  return { name, kind, status, vote_mode, opens, closes };
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.length >= 3 ? base : `simulasi-${Date.now().toString(36)}`;
}

async function uniqueSlug(preferred: string): Promise<string> {
  let slug = preferred;
  for (let i = 2; i <= 40; i++) {
    const exists = await sql`select 1 from events where slug = ${slug} limit 1`;
    if (exists.length === 0) return slug;
    const suffix = `-${i}`;
    slug = `${preferred.slice(0, 60 - suffix.length).replace(/-+$/, "")}${suffix}`;
  }
  throw new HttpError(409, "Terlalu banyak nama serupa — tentukan URL sendiri.");
}

export async function createEvent(
  draft: EventDraft & { slug?: string },
  actor: string,
  ip: string,
): Promise<EventRow> {
  const v = validateDraft(draft);
  const explicit = (draft.slug || "").trim().toLowerCase();
  if (explicit && !isValidSlug(explicit)) {
    throw new HttpError(400, "URL hanya huruf kecil, angka, dan tanda hubung (3–60 karakter).");
  }
  let slug: string;
  if (explicit) {
    const taken = await sql`select 1 from events where slug = ${explicit} limit 1`;
    if (taken.length) throw new HttpError(409, `URL /${explicit} sudah dipakai simulasi lain.`);
    slug = explicit;
  } else {
    slug = await uniqueSlug(slugify(v.name));
  }
  const ev = await sql.begin(async (tx) => {
    const rows = await tx`
      insert into events (slug, name, kind, status, vote_mode, opens_at, closes_at)
      values (${slug}, ${v.name}, ${v.kind}, ${v.status}, ${v.vote_mode}, ${v.opens}, ${v.closes})
      returning id, slug, name, kind, status, vote_mode, opens_at, closes_at, is_default, archived_at`;
    const created = rows[0] as EventRow;
    await platformAudit(actor, "EVENT_CREATED", `Simulasi "${v.name}" dibuat dengan URL /${slug}`, created.id, ip, tx);
    return created;
  });
  return ev;
}

export async function updateEvent(
  ev: EventRow,
  draft: EventDraft & { slug?: string },
  actor: string,
  ip: string,
): Promise<EventRow> {
  const v = validateDraft(draft);
  let slug = ev.slug;
  const wanted = (draft.slug || "").trim().toLowerCase();
  if (wanted && wanted !== ev.slug) {
    if (!isValidSlug(wanted)) throw new HttpError(400, "URL hanya huruf kecil, angka, dan tanda hubung (3–60 karakter).");
    const taken = await sql`select 1 from events where slug = ${wanted} and id <> ${ev.id} limit 1`;
    if (taken.length) throw new HttpError(409, `URL /${wanted} sudah dipakai simulasi lain.`);
    slug = wanted;
  }
  const changes = [
    slug !== ev.slug ? `URL berubah: /${ev.slug} → /${slug}` : null,
    v.status !== ev.status ? `status ${ev.status} → ${v.status}` : null,
    v.vote_mode !== ev.vote_mode ? `mode ${ev.vote_mode} → ${v.vote_mode}` : null,
    v.name !== ev.name ? `nama "${ev.name}" → "${v.name}"` : null,
  ].filter(Boolean);
  await sql.begin(async (tx) => {
    await tx`
      update events set name = ${v.name}, kind = ${v.kind}, status = ${v.status}, vote_mode = ${v.vote_mode},
                        opens_at = ${v.opens}, closes_at = ${v.closes}, slug = ${slug},
                        archived_at = case when ${v.status} = 'archived' then coalesce(archived_at, now()) else null end
      where id = ${ev.id}`;
    await platformAudit(
      actor,
      "EVENT_UPDATED",
      changes.length ? changes.join(", ") : `Detail simulasi /${slug} disimpan tanpa perubahan berarti`,
      ev.id,
      ip,
      tx,
    );
  });
  return {
    ...ev,
    slug,
    name: v.name,
    kind: v.kind,
    status: v.status as EventRow["status"],
    vote_mode: v.vote_mode as EventRow["vote_mode"],
    opens_at: v.opens,
    closes_at: v.closes,
  };
}

export async function setDefaultEvent(ev: EventRow, actor: string, ip: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`update events set is_default = (id = ${ev.id})`;
    await platformAudit(actor, "EVENT_SET_DEFAULT", `Halaman depan kini menuju /${ev.slug} (${ev.name})`, ev.id, ip, tx);
  });
}

export async function eventVoterCount(eventId: number): Promise<number> {
  return withEvent(eventId, async (tx) => {
    const rows = await tx`select count(*)::int as n from voters`;
    return rows[0].n as number;
  });
}

/**
 * Hapus permanen satu simulasi beserta seluruh datanya. Hanya dipanggil untuk
 * event berstatus arsip (dijaga di route) — tidak bisa dibatalkan.
 */
export async function deleteEventCompletely(ev: EventRow, actor: string, ip: string): Promise<void> {
  await withPlatform(async (tx) => {
    await tx`delete from votes where event_id = ${ev.id}`;
    await tx`delete from voters where event_id = ${ev.id}`;
    await tx`delete from candidates where event_id = ${ev.id}`;
    await tx`delete from audit_logs where event_id = ${ev.id}`;
    await tx`delete from event_settings where event_id = ${ev.id}`;
    await tx`delete from events where id = ${ev.id}`;
    await platformAudit(
      actor,
      "EVENT_DELETED",
      `Simulasi "${ev.name}" (/${ev.slug}) beserta seluruh datanya dihapus permanen`,
      null,
      ip,
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Kredensial panitia & impersonasi
// ---------------------------------------------------------------------------

/** Kredensial panitia disimpan di event_settings — mekanisme panel yang sudah ada. */
export async function setEventCredentials(
  ev: EventRow,
  username: string,
  password: string,
  actor: string,
  ip: string,
): Promise<void> {
  const user = username.trim().toLowerCase();
  if (!USERNAME_RE.test(user)) {
    throw new HttpError(400, "Username panitia 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.");
  }
  if (password.length < 8) throw new HttpError(400, "Password panitia minimal 8 karakter.");
  if (password.length > 100) throw new HttpError(400, "Password terlalu panjang.");
  await withEvent(ev.id, async (tx) => {
    await setEventSetting(ev.id, "admin_username", user, tx);
    await setEventSetting(ev.id, "admin_password_hash", hashPassword(password), tx);
    await platformAudit(
      actor,
      "EVENT_CREDENTIALS_SET",
      `Kredensial panitia simulasi /${ev.slug} diganti (username "${user}")`,
      ev.id,
      ip,
      tx,
    );
  });
}

export async function readEventPanelStatus(ev: EventRow): Promise<{ username: string; configured: boolean }> {
  const settings = await withEvent(ev.id, (tx) =>
    tx`select key, value from event_settings where key in ('admin_username', 'admin_password_hash')`);
  const map: Record<string, string> = {};
  for (const r of settings) map[r.key as string] = r.value as string;
  return { username: map.admin_username || "admin", configured: Boolean(map.admin_password_hash) };
}

/**
 * Pintu masuk impersonasi: superadmin boleh memakai panel panitia persis seperti
 * login biasa (cookie dan option-nya identik — lihat setPanelCookie), tetapi hanya
 * untuk simulasi yang sudah punya password supaya panel tidak dibuka diam-diam
 * sebelum panitia mengonfigurasinya.
 */
export async function allowPanelImpersonation(ev: EventRow, actor: string, ip: string): Promise<void> {
  const status = await readEventPanelStatus(ev);
  if (!status.configured) {
    throw new HttpError(409, `Panel /${ev.slug} belum punya password. Atur kredensial panitia terlebih dahulu.`);
  }
  await platformAudit(actor, "EVENT_IMPERSONATE", `Masuk ke panel panitia /${ev.slug} sebagai superadmin`, ev.id, ip);
}

// ---------------------------------------------------------------------------
// Audit & sesi konsol (laporan)
// ---------------------------------------------------------------------------

export type PlatformAuditRow = {
  id: number;
  actor: string;
  action: string;
  detail: string;
  event_id: number | null;
  slug: string | null;
  ip: string;
  created_at: string;
};

export type PlatformAuditFilter = {
  eventId: number | null;
  dari: string;
  sampai: string;
  jamDari: string;
  jamSampai: string;
  aksi: string;
  aktor: string;
  cari: string;
};

/**
 * Audit konsol dengan filter yang sama seperti audit per simulasi. Kolomnya
 * sengaja identik (action/detail/actor/ip/created_at) supaya komponen filter
 * yang sudah ada bisa dipakai ulang tanpa membuat sistem kedua.
 */
export async function listPlatformAudit(f: PlatformAuditFilter, limit = 200) {
  const pola = f.cari ? `%${f.cari.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;
  const rows = await sql`
    with waktu_wib as (
      select a.id, a.actor, a.action, a.detail, a.event_id, a.ip, a.created_at, e.slug,
             (a.created_at at time zone 'Asia/Jakarta')::date as tgl,
             (a.created_at at time zone 'Asia/Jakarta')::time as jam
      from platform_audit a
      left join events e on e.id = a.event_id
    )
    select id, actor, action, detail, event_id, ip, created_at, slug,
           cast(count(*) over () as int) as total
    from waktu_wib
    where (${f.eventId}::int is null or event_id = ${f.eventId}::int)
      and (${f.dari || null}::date is null or tgl >= ${f.dari || null}::date)
      and (${f.sampai || null}::date is null or tgl <= ${f.sampai || null}::date)
      and (${f.jamDari || null}::text is null or to_char(jam, 'HH24:MI') >= ${f.jamDari || null}::text)
      and (${f.jamSampai || null}::text is null or to_char(jam, 'HH24:MI') <= ${f.jamSampai || null}::text)
      and (${f.aksi || null}::text is null or action = ${f.aksi || null}::text)
      and (${f.aktor || null}::text is null or actor = ${f.aktor || null}::text)
      and (${pola}::text is null or detail ilike ${pola}::text or action ilike ${pola}::text
                      or actor ilike ${pola}::text or coalesce(ip, '') ilike ${pola}::text)
    order by id desc
    limit ${limit}`;
  const actors = await sql`select distinct actor from platform_audit order by actor`;
  const actions = await sql`select distinct action from platform_audit order by action`;
  return {
    rows: rows as unknown as (PlatformAuditRow & { total: number })[],
    total: rows.length ? (rows[0] as unknown as { total: number }).total : 0,
    actorOptions: actors.map((r) => r.actor as string),
    actionOptions: actions.map((r) => r.action as string),
  };
}

export type PlatformSessionRow = {
  id: number;
  username: string;
  name: string;
  ip: string;
  user_agent: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
};

export async function listPlatformSessions(limit = 30): Promise<PlatformSessionRow[]> {
  const rows = await sql`
    select s.id, u.username, u.name, s.ip, s.user_agent, s.created_at, s.last_seen_at, s.expires_at
    from platform_sessions s
    join platform_users u on u.id = s.user_id
    where s.revoked_at is null and s.expires_at > now()
    order by s.last_seen_at desc
    limit ${limit}`;
  return rows as unknown as PlatformSessionRow[];
}

export async function revokePlatformSession(sessionId: number, actor: string, ip: string): Promise<boolean> {
  return sql.begin(async (tx) => {
    const rows = await tx`
      update platform_sessions set revoked_at = now()
      where id = ${sessionId} and revoked_at is null
      returning user_id`;
    if (rows.length === 0) return false;
    await platformAudit(actor, "SESSION_REVOKED", `Sesi konsol #${sessionId} dicabut`, null, ip, tx);
    return true;
  });
}

/** Cabut semua sesi milik satu akun (dipakai setelah password akun itu diganti). */
export async function revokeAllSessionsOf(userId: number, tx: EventTx): Promise<number> {
  const rows = await tx`
    update platform_sessions set revoked_at = now()
    where user_id = ${userId} and revoked_at is null and expires_at > now()
    returning id`;
  return rows.length;
}

// ---------------------------------------------------------------------------
// Akun konsol
// ---------------------------------------------------------------------------

export type PlatformUserRow = PlatformUser & { created_at: string; last_login_at: string | null; sessions: number };

export async function listPlatformUsers(): Promise<PlatformUserRow[]> {
  const rows = await sql`
    select u.id, u.username, u.name, u.created_at, u.last_login_at,
           cast((select count(*) from platform_sessions s
                  where s.user_id = u.id and s.revoked_at is null and s.expires_at > now()) as int) as sessions
    from platform_users u
    order by u.created_at`;
  return rows as unknown as PlatformUserRow[];
}

export async function createPlatformUser(
  input: { username: string; name?: string; password: string },
  actor: string,
  ip: string,
): Promise<PlatformUser> {
  const username = (input.username || "").trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new HttpError(400, "Username 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.");
  }
  if ((input.password || "").length < 10) throw new HttpError(400, "Password akun konsol minimal 10 karakter.");
  const taken = await sql`select 1 from platform_users where username = ${username} limit 1`;
  if (taken.length) throw new HttpError(409, `Username "${username}" sudah dipakai.`);
  const user = await sql.begin(async (tx) => {
    const rows = await tx`
      insert into platform_users (username, name, password_hash)
      values (${username}, ${(input.name || "").trim().slice(0, 60)}, ${hashPassword(input.password)})
      returning id, username, name`;
    const created = rows[0] as PlatformUser;
    await platformAudit(actor, "USER_CREATED", `Akun konsol "${username}" dibuat`, null, ip, tx);
    return created;
  });
  return user;
}

export async function changePlatformUserPassword(
  userId: number,
  password: string,
  actor: string,
  ip: string,
): Promise<{ revoked: number }> {
  if (password.length < 10) throw new HttpError(400, "Password minimal 10 karakter.");
  const rows = await sql`select username from platform_users where id = ${userId} limit 1`;
  if (rows.length === 0) throw new HttpError(404, "Akun tidak ditemukan.");
  const hash = hashPassword(password);
  return sql.begin(async (tx) => {
    await tx`update platform_users set password_hash = ${hash} where id = ${userId}`;
    const revoked = await revokeAllSessionsOf(userId, tx);
    await platformAudit(
      actor,
      "USER_PASSWORD_CHANGED",
      `Password akun "${rows[0].username}" diganti; ${revoked} sesi ikut dicabut`,
      null,
      ip,
      tx,
    );
    return { revoked };
  });
}

export async function deletePlatformUser(userId: number, actor: string, ip: string): Promise<void> {
  const rows = await sql`select username from platform_users where id = ${userId} limit 1`;
  if (rows.length === 0) throw new HttpError(404, "Akun tidak ditemukan.");
  const total = await sql`select count(*)::int as n from platform_users`;
  if (total[0].n <= 1) throw new HttpError(409, "Minimal satu akun konsol harus tersisa.");
  await sql.begin(async (tx) => {
    await tx`delete from platform_users where id = ${userId}`;
    await platformAudit(actor, "USER_DELETED", `Akun konsol "${rows[0].username}" dihapus beserta sesi aktifnya`, null, ip, tx);
  });
}
