import Link from "next/link";
import PlatformRecapFilters from "@/components/PlatformRecapFilters";
import { EVENT_KIND_LABELS, EVENT_STATUS_LABELS, labelsFor, votingStatus } from "@/lib/event";
import { filterRecaps, listEventRecaps, type EventRecap } from "@/lib/platform";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const KIND_RE = /^[a-z_]{3,20}$/;
const STATUS_RE = /^[a-z_]{3,20}$/;
const TEXT_RE = /^[\p{L}\p{N}\p{P}\p{Zs}]{1,80}$/u;

function read(sp: SearchParams, key: string, re: RegExp) {
  const raw = sp[key];
  const value = typeof raw === "string" ? raw.trim() : "";
  return re.test(value) ? value : "";
}

const STATUS_BADGE: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-600",
  archived: "bg-amber-100 text-amber-700",
  draft: "bg-sky-100 text-sky-700",
};

const pct = (bagian: number, total: number) => (total ? (bagian / total) * 100 : 0);
const angka = (n: number) => n.toLocaleString("id-ID");
const persen = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

/** Baris hasil: pemimpin ditebalkan, sisanya urut perolehan lalu nomor. */
function Options({ ev }: { ev: EventRecap }) {
  if (!ev.options.length) return <p className="text-[11px] text-slate-400">Belum ada opsi didaftarkan.</p>;
  const tertinggi = Math.max(...ev.options.map((o) => o.votes));
  const urut = [...ev.options].sort((a, b) => b.votes - a.votes || a.number - b.number);
  return (
    <ul className="space-y-1">
      {urut.map((o) => {
        const p = persen(pct(o.votes, ev.votes));
        const pemimpin = tertinggi > 0 && o.votes === tertinggi;
        return (
          <li key={o.number} className="flex items-center gap-2">
            <span
              className={`w-6 shrink-0 text-center text-[11px] font-bold ${pemimpin ? "text-violet-700" : "text-slate-500"}`}
              title={`Nomor ${o.number}`}
            >
              {o.number}
            </span>
            <span className={`min-w-0 flex-1 truncate text-[11px] ${pemimpin ? "font-semibold text-slate-800" : "text-slate-600"}`}>
              {o.name}
              {!o.active && <span className="ml-1 text-[10px] font-semibold text-slate-400">nonaktif</span>}
            </span>
            <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:w-24">
              <span
                className={`block h-full rounded-full ${pemimpin ? "bg-violet-600" : "bg-slate-300"}`}
                style={{ width: `${pct(o.votes, ev.votes)}%` }}
              />
            </span>
            <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-slate-600">
              {angka(o.votes)} <span className="text-slate-400">({p})</span>
            </span>
          </li>
        );
      })}
      <li className="pt-0.5 text-[10px] text-slate-400">
        {ev.votes ? "Tebal = perolehan tertinggi." : "Belum ada suara masuk."}
      </li>
    </ul>
  );
}

export default async function PlatformRecapPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const values = {
    kind: read(sp, "kind", KIND_RE),
    status: read(sp, "status", STATUS_RE),
    cari: read(sp, "cari", TEXT_RE),
  };

  const semua = await listEventRecaps();
  const events = filterRecaps(semua, values);

  const pemilih = events.reduce((a, e) => a + e.voters, 0);
  const memilih = events.reduce((a, e) => a + e.voted, 0);
  const suara = events.reduce((a, e) => a + e.votes, 0);
  const berjalan = events.filter((e) => votingStatus(e).open).length;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v) params.set(k, v);
  const qs = params.toString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Rekap Lintas Simulasi</h2>
          <p className="max-w-3xl text-xs text-slate-500">
            Perolehan suara semua simulasi dalam satu tabel. Angka diambil dari basis data yang sama dengan panel panitia,
            jadi tidak perlu membuka tiap simulasi untuk memantau perkembangan.
            {qs ? " Filter aktif ikut dipakai saat ekspor CSV." : ""}
          </p>
        </div>
        <Link
          href="/platform"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Kelola simulasi
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Simulasi tampil", value: `${events.length}/${semua.length}` },
          { label: "Menerima suara", value: berjalan },
          { label: "Pemilih / sudah memilih", value: `${angka(pemilih)} / ${angka(memilih)}` },
          { label: "Suara tercatat", value: angka(suara) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-1 text-xl font-extrabold text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>

      <PlatformRecapFilters
        values={values}
        kindOptions={Object.entries(EVENT_KIND_LABELS).map(([value, label]) => ({ value, label }))}
        statusOptions={Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        exportHref={`/api/platform/rekap/export${qs ? `?${qs}` : ""}`}
      />

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Simulasi</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Partisipasi</th>
              <th className="px-4 py-2">Perolehan</th>
              <th className="px-4 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((ev) => {
              const efektif = votingStatus(ev);
              const L = labelsFor(ev.kind);
              const ikut = persen(pct(ev.voted, ev.voters));
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
                    <p className="text-[11px] text-slate-500">
                      {EVENT_KIND_LABELS[ev.kind] || ev.kind} · {ev.vote_mode === "live" ? "live" : "simulasi"}
                    </p>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[ev.status] || "bg-slate-100 text-slate-600"}`}
                    >
                      {EVENT_STATUS_LABELS[ev.status] || ev.status}
                    </span>
                    {efektif.label !== (EVENT_STATUS_LABELS[ev.status] || ev.status) && (
                      <p title={efektif.reason} className={`mt-1 text-[10px] font-semibold ${efektif.open ? "text-emerald-600" : "text-red-600"}`}>
                        kiosk: {efektif.label.toLowerCase()}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <p className="text-xs font-semibold tabular-nums text-slate-700">
                      {angka(ev.voted)}
                      <span className="font-normal text-slate-400">/{angka(ev.voters)}</span>{" "}
                      <span className="text-[11px] font-normal text-slate-500">{ikut}</span>
                    </p>
                    <span className="mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct(ev.voted, ev.voters)}%` }} />
                    </span>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {L.pemilih} · {L.coblosKata}
                    </p>
                  </td>
                  <td className="min-w-[18rem] px-4 py-2">
                    <Options ev={ev} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/platform/e/${ev.slug}`}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Kelola
                    </Link>
                  </td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-400">
                  {semua.length === 0
                    ? "Belum ada simulasi terdaftar di platform ini."
                    : "Tidak ada simulasi yang cocok dengan filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
