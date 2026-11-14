import Link from "next/link";
import { ensureSchema, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await ensureSchema();
  const rows = await sql`select c.id, c.number, c.name, c.photo_url, count(v.id)::int as votes
                         from candidates c
                         left join votes v on v.candidate_id = c.id
                         group by c.id, c.number, c.name, c.photo_url
                         order by c.number`;
  const [tot] = await sql`select
      (select count(*)::int from voters) as total_voters,
      (select count(*)::int from voters where has_voted) as voted,
      (select count(*)::int from votes) as total_votes`;
  const [settings] = await sql`select value from settings where key = 'election_status'`;
  const status = settings?.value === "closed" ? "closed" : "open";
  const participation = tot.total_voters ? Math.round((tot.voted / tot.total_voters) * 100) : 0;
  const maxVotes = Math.max(1, ...rows.map((r: { votes: number }) => r.votes));

  const stats = [
    { label: "Pemilih Terdaftar", value: tot.total_voters },
    { label: "Sudah Mencoblos", value: tot.voted },
    { label: "Total Suara Masuk", value: tot.total_votes },
    { label: "Partisipasi", value: `${participation}%` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Rekapitulasi Suara</h2>
          <p className="text-xs text-slate-500">
            Status pemungutan:{" "}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}
            >
              {status === "open" ? "DIBUKA" : "DITUTUP"}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/api/admin/rekap?csv=1"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </Link>
          <Link
            href="/admin"
            className="rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            Muat Ulang
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800">Perolehan per Calon</h3>
        <div className="mt-4 space-y-4">
          {rows.map((c: { id: number; number: number; name: string; photo_url: string; votes: number }) => {
            const pct = tot.total_votes ? ((c.votes / tot.total_votes) * 100).toFixed(1) : "0.0";
            return (
              <div key={c.id} className="flex items-center gap-3">
                <img src={c.photo_url} alt={c.name} className="h-12 w-10 rounded border border-slate-200 object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                        {c.number}
                      </span>
                      {c.name}
                    </p>
                    <p className="shrink-0 text-sm font-bold text-slate-900">
                      {c.votes} <span className="text-[11px] font-normal text-slate-500">({pct}%)</span>
                    </p>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${(c.votes / maxVotes) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
