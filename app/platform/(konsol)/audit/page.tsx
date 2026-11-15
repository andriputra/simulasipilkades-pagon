import Link from "next/link";
import AuditFilters, { type AuditFilterValues } from "@/components/AuditFilters";
import { listEventSummaries, listPlatformAudit } from "@/lib/platform";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const WORD_RE = /^[A-Za-z0-9_ .:@#-]{1,60}$/;
const TEXT_RE = /^[\p{L}\p{N}\p{P}\p{Zs}]{1,120}$/u;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

function read(sp: SearchParams, key: string, re?: RegExp) {
  const raw = sp[key];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  return re && !re.test(value) ? "" : value;
}

const BADGE: Record<string, string> = {
  LOGIN: "bg-emerald-100 text-emerald-700",
  LOGIN_FAILED: "bg-red-100 text-red-700",
  LOGIN_RATE_LIMITED: "bg-red-100 text-red-700",
  LOGOUT: "bg-slate-100 text-slate-600",
  EVENT_CREATED: "bg-violet-100 text-violet-700",
  EVENT_UPDATED: "bg-sky-100 text-sky-700",
  EVENT_SET_DEFAULT: "bg-blue-100 text-blue-700",
  EVENT_DELETED: "bg-red-100 text-red-700",
  EVENT_CREDENTIALS_SET: "bg-amber-100 text-amber-700",
  EVENT_IMPERSONATE: "bg-fuchsia-100 text-fuchsia-700",
  RECAP_EXPORTED: "bg-emerald-100 text-emerald-700",
  USER_CREATED: "bg-teal-100 text-teal-700",
  USER_DELETED: "bg-orange-100 text-orange-700",
  USER_PASSWORD_CHANGED: "bg-amber-100 text-amber-700",
  SESSION_REVOKED: "bg-indigo-100 text-indigo-700",
};

export default async function PlatformAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const values: AuditFilterValues = {
    event: read(sp, "event", SLUG_RE),
    dari: read(sp, "dari", DATE_RE),
    sampai: read(sp, "sampai", DATE_RE),
    jam_dari: read(sp, "jam_dari", TIME_RE),
    jam_sampai: read(sp, "jam_sampai", TIME_RE),
    aksi: read(sp, "aksi", WORD_RE),
    aktor: read(sp, "aktor", WORD_RE),
    cari: read(sp, "cari", TEXT_RE),
  };

  const events = await listEventSummaries();
  const eventId = values.event ? (events.find((e) => e.slug === values.event)?.id ?? null) : null;

  const { rows, total, actorOptions, actionOptions } = await listPlatformAudit(
    {
      eventId,
      dari: values.dari,
      sampai: values.sampai,
      jamDari: values.jam_dari,
      jamSampai: values.jam_sampai,
      aksi: values.aksi,
      aktor: values.aktor,
      cari: values.cari,
    },
    200,
  );

  const adaFilter = Object.values(values).some(Boolean);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Audit Konsol</h2>
        <p className="text-xs text-slate-500">
          Menampilkan {rows.length} dari {total} aksi konsol{adaFilter ? " yang cocok dengan filter" : " terakhir"}.
          Jejak Superadmin: membuat/mengubah simulasi, mengganti kredensial panitia, masuk sebagai panitia, dan
          pengelolaan akun. Aktivitas pemungutan suara tetap tercatat di audit log masing-masing simulasi.
        </p>
      </div>

      <AuditFilters
        values={values}
        aksiOptions={actionOptions}
        aktorOptions={actorOptions}
        eventOptions={events.map((e) => ({ slug: e.slug, name: e.name }))}
      />

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Waktu (WIB)</th>
              <th className="px-4 py-2">Aksi</th>
              <th className="px-4 py-2">Detail</th>
              <th className="px-4 py-2">Simulasi</th>
              <th className="px-4 py-2">Oleh</th>
              <th className="px-4 py-2">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{fmt(r.created_at)}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[r.action] || "bg-slate-100 text-slate-600"}`}>
                    {r.action}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-slate-700">{r.detail}</td>
                <td className="px-4 py-2 text-xs">
                  {r.slug ? (
                    <Link href={`/platform/e/${r.slug}`} className="font-mono text-[11px] text-violet-700 hover:underline">
                      /{r.slug}
                    </Link>
                  ) : (
                    <span className="text-[11px] text-slate-400">platform</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">{r.actor}</td>
                <td className="px-4 py-2 font-mono text-[11px] text-slate-400">{r.ip || "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">
                  {adaFilter ? "Tidak ada aksi konsol yang cocok dengan filter." : "Belum ada aksi konsol tercatat."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
