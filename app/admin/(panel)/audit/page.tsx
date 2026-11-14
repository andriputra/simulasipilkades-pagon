import AuditFilters, { type AuditFilterValues } from "@/components/AuditFilters";
import { ensureSchema, sql, type AuditLog } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const WORD_RE = /^[A-Za-z0-9_ .:@#-]{1,60}$/;
const TEXT_RE = /^[\p{L}\p{N}\p{P}\p{Zs}]{1,120}$/u;

function read(sp: SearchParams, key: string, re?: RegExp) {
  const raw = sp[key];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  return re && !re.test(value) ? "" : value;
}

const BADGE: Record<string, string> = {
  LOGIN_SUCCESS: "bg-emerald-100 text-emerald-700",
  LOGIN_FAILED: "bg-red-100 text-red-700",
  LOGOUT: "bg-slate-100 text-slate-600",
  VOTE_CAST: "bg-blue-100 text-blue-700",
  VOTES_RESET: "bg-red-100 text-red-700",
  PASSWORD_CHANGED: "bg-amber-100 text-amber-700",
  VOTER_CREATED: "bg-violet-100 text-violet-700",
  VOTER_UPDATED: "bg-sky-100 text-sky-700",
  VOTER_DELETED: "bg-orange-100 text-orange-700",
  VOTE_UPDATED: "bg-indigo-100 text-indigo-700",
  VOTER_UNLOCKED: "bg-amber-100 text-amber-800",
  VOTE_MODE_CHANGED: "bg-cyan-100 text-cyan-700",
  CANDIDATE_UPDATED: "bg-teal-100 text-teal-700",
  CANDIDATE_CREATED: "bg-lime-100 text-lime-800",
  CANDIDATE_DELETED: "bg-rose-100 text-rose-700",
};

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await ensureSchema();
  const sp = await searchParams;

  const values: AuditFilterValues = {
    dari: read(sp, "dari", DATE_RE),
    sampai: read(sp, "sampai", DATE_RE),
    jam_dari: read(sp, "jam_dari", TIME_RE),
    jam_sampai: read(sp, "jam_sampai", TIME_RE),
    aksi: read(sp, "aksi", WORD_RE),
    aktor: read(sp, "aktor", WORD_RE),
    cari: read(sp, "cari", TEXT_RE),
  };

  const vDari = values.dari || null;
  const vSampai = values.sampai || null;
  const vJamDari = values.jam_dari || null;
  const vJamSampai = values.jam_sampai || null;
  const vAksi = values.aksi || null;
  const vAktor = values.aktor || null;
  const vCari = values.cari || null;
  const pola = vCari ? `%${vCari.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;

  const logs = (await sql`
    with waktu_wib as (
      select id, action, detail, actor, ip, created_at,
             (created_at at time zone 'Asia/Jakarta')::date as tgl,
             (created_at at time zone 'Asia/Jakarta')::time as jam
      from audit_logs
    )
    select id, action, detail, actor, ip, created_at, cast(count(*) over () as int) as total
    from waktu_wib
    where (${vDari}::date is null or tgl >= ${vDari}::date)
      and (${vSampai}::date is null or tgl <= ${vSampai}::date)
      and (${vJamDari}::time is null or jam >= ${vJamDari}::time)
      and (${vJamSampai}::time is null or jam <= ${vJamSampai}::time)
      and (${vAksi}::text is null or action = ${vAksi}::text)
      and (${vAktor}::text is null or actor = ${vAktor}::text)
      and (${pola}::text is null or detail ilike ${pola}::text or action ilike ${pola}::text
                      or actor ilike ${pola}::text or coalesce(ip, '') ilike ${pola}::text)
    order by id desc
    limit 200`) as (AuditLog & { total: number })[];

  const [aksiRows, aktorRows] = await Promise.all([
    sql`select distinct action from audit_logs order by action`,
    sql`select distinct actor from audit_logs order by actor`,
  ]);
  const aksiOptions = aksiRows.map((r) => r.action as string);
  const aktorOptions = aktorRows.map((r) => r.actor as string);

  const total = logs.length ? logs[0].total : 0;
  const adaFilter = Object.values(values).some(Boolean);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta",
    });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Audit Log</h2>
        <p className="text-xs text-slate-500">
          Menampilkan {logs.length} dari {total} aktivitas{adaFilter ? " yang cocok dengan filter" : " terakhir"}.
          {total > logs.length ? " Hanya 200 aktivitas terbaru yang ditampilkan — persempit dengan filter tanggal atau jam." : ""}{" "}
          Catatan pencoblosan disimpan tanpa mengungkapkan pilihan (rahasia).
        </p>
      </div>

      <AuditFilters values={values} aksiOptions={aksiOptions} aktorOptions={aktorOptions} />

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Waktu (WIB)</th>
              <th className="px-4 py-2">Aksi</th>
              <th className="px-4 py-2">Detail</th>
              <th className="px-4 py-2">Aktor</th>
              <th className="px-4 py-2">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id} className="align-top hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{fmt(l.created_at)}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[l.action] || "bg-slate-100 text-slate-600"}`}>
                    {l.action}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-slate-700">{l.detail}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{l.actor}</td>
                <td className="px-4 py-2 font-mono text-[11px] text-slate-400">{l.ip || "-"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-400">
                  {adaFilter ? "Tidak ada aktivitas yang cocok dengan filter." : "Belum ada aktivitas tercatat."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
