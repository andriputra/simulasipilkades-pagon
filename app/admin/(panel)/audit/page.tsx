import { ensureSchema, sql, type AuditLog } from "@/lib/db";

export const dynamic = "force-dynamic";

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
};

export default async function AdminAuditPage() {
  await ensureSchema();
  const logs: AuditLog[] = await sql`select id, action, detail, actor, ip, created_at
                                     from audit_logs order by id desc limit 200`;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("id-ID", {
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
        <h2 className="text-lg font-bold text-slate-800">Audit Log</h2>
        <p className="text-xs text-slate-500">200 aktivitas terakhir. Catatan pencoblosan disimpan tanpa mengungkapkan pilihan (rahasia).</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Waktu</th>
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
                  Belum ada aktivitas tercatat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
