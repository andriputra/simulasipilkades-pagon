import Link from "next/link";
import PlatformRowActions from "@/components/PlatformRowActions";
import { EVENT_KIND_LABELS, EVENT_STATUS_LABELS, isVotingOpen, votingStatus } from "@/lib/event";
import { listEventSummaries } from "@/lib/platform";

export const dynamic = "force-dynamic";

/** Jadwal dalam WIB; format lokal dibuat server-side agar tabel tidak berubah saat hydration. */
function jadwal(ev: { opens_at: Date | string | null; closes_at: Date | string | null }): string {
  const opt: Intl.DateTimeFormatOptions = { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" };
  const fmt = (v: Date | string) => new Date(v).toLocaleString("id-ID", opt);
  if (ev.opens_at && ev.closes_at) return `${fmt(ev.opens_at)} → ${new Date(ev.closes_at).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })}`;
  if (ev.opens_at) return `buka ${fmt(ev.opens_at)}`;
  if (ev.closes_at) return `tutup ${fmt(ev.closes_at)}`;
  return "manual";
}

const STATUS_BADGE: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-600",
  archived: "bg-amber-100 text-amber-700",
  draft: "bg-sky-100 text-sky-700",
};

export default async function PlatformEventsPage() {
  const events = await listEventSummaries();
  const menerimaSuara = events.filter((e) => isVotingOpen(e)).length;
  const pemilih = events.reduce((a, e) => a + e.voters, 0);
  const suara = events.reduce((a, e) => a + e.votes, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Simulasi</h2>
          <p className="max-w-3xl text-xs text-slate-500">
            {events.length} simulasi terdaftar · {menerimaSuara} sedang menerima suara · {pemilih} pemilih · {suara} suara
            masuk. Setiap simulasi punya kiosk, data, dan akun panitia sendiri di URL{" "}
            <span className="font-mono">/e/nama-url</span>.
          </p>
        </div>
        <Link
          href="/platform/simulasi/baru"
          className="rounded-md bg-violet-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-800"
        >
          + Tambah Simulasi
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total simulasi", value: events.length },
          { label: "Menerima suara", value: menerimaSuara },
          { label: "Pemilih terdaftar", value: pemilih },
          { label: "Suara tercatat", value: suara },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Simulasi</th>
              <th className="px-4 py-2">Jenis / Mode</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Jadwal (WIB)</th>
              <th className="px-4 py-2 text-right">Pemilih</th>
              <th className="px-4 py-2 text-right">Suara</th>
              <th className="px-4 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((ev) => {
              const efektif = votingStatus(ev);
              const manual = EVENT_STATUS_LABELS[ev.status] || ev.status;
              return (
              <tr key={ev.id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/platform/e/${ev.slug}`} className="text-sm font-semibold text-blue-700 hover:underline">
                    {ev.name}
                  </Link>
                  <p className="font-mono text-[11px] text-slate-500">
                    /e/{ev.slug}
                    {ev.is_default && (
                      <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">DEPAN</span>
                    )}
                  </p>
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {EVENT_KIND_LABELS[ev.kind] || ev.kind}
                  <p className="text-[11px] text-slate-500">
                    {ev.vote_mode === "live" ? "Live — 1 suara terkunci" : "Simulasi — kode boleh diulang"}
                  </p>
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[ev.status] || "bg-slate-100 text-slate-600"}`}>
                    {manual}
                  </span>
                  {manual !== efektif.label && (
                    <p title={`${efektif.label}: ${efektif.reason}`} className={`mt-1 text-[10px] font-semibold ${efektif.open ? "text-emerald-600" : "text-red-600"}`}>
                      kiosk: {efektif.label.toLowerCase()}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-[11px] text-slate-500">{jadwal(ev)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-xs text-slate-700">
                  {ev.voted}
                  <span className="text-slate-400">/{ev.voters}</span>
                </td>
                <td className="px-4 py-2 text-right text-xs font-semibold text-slate-700">{ev.votes}</td>
                <td className="px-4 py-2 text-right">
                  <PlatformRowActions slug={ev.slug} name={ev.name} />
                </td>
              </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-400">
                  Belum ada simulasi. Klik &quot;+ Tambah Simulasi&quot; untuk membuat yang pertama.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
