"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEventLabels } from "@/components/EventLabels";
import { lower } from "@/lib/event-meta";
import { useEventSlug } from "@/lib/use-event-slug";

type RecapRow = { id: number; number: number; name: string; photo_url: string; votes: number };
type Totals = { total_voters: number; voted: number; total_votes: number };
type LiveRow = { id: number; action: string; detail: string; created_at: string };
type Payload = {
  candidates: RecapRow[];
  totals: Totals;
  status: "open" | "closed";
  status_label: string;
  status_reason: string;
  vote_mode: "simulasi" | "live";
  recent: LiveRow[];
};

const POLL_MS = 4000;

function useCountUp(target: number, duration = 650) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    const reduced =
      document.hidden || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (reduced) {
      current.current = target;
      setValue(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      current.current = from + (target - from) * eased;
      setValue(current.current);
      if (p < 1) raf = requestAnimationFrame(step);
      else {
        current.current = target;
        setValue(target);
      }
    };
    raf = requestAnimationFrame(step);
    const ensure = window.setTimeout(() => {
      current.current = target;
      setValue(target);
    }, duration + 150);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(ensure);
    };
  }, [target, duration]);
  return Math.round(value);
}

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 5) return "baru saja";
  if (s < 60) return `${s} detik lalu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}

const ACT_STYLE: Record<string, { dot: string; label: string }> = {
  VOTE_CAST: { dot: "bg-blue-500", label: "Suara masuk" },
  VOTE_UPDATED: { dot: "bg-amber-500", label: "Suara diubah" },
  VOTES_RESET: { dot: "bg-red-500", label: "Reset suara" },
};

const ghostBtn =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50";
const solidBtn = "rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800";

export default function AdminDashboardPage() {
  const slug = useEventSlug();
  const L = useEventLabels();
  const [data, setData] = useState<Payload | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<Record<number, number>>({});
  const [sort, setSort] = useState<"number" | "votes">("number");
  const [newVotes, setNewVotes] = useState(0);
  const prevVotes = useRef<Record<number, number>>({});
  const prevTotal = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/e/${slug}/admin/rekap`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as Payload;
      const changed: Record<number, number> = {};
      for (const c of json.candidates) {
        const before = prevVotes.current[c.id];
        if (before !== undefined && c.votes !== before) changed[c.id] = c.votes - before;
        prevVotes.current[c.id] = c.votes;
      }
      const gained = json.totals.total_votes - prevTotal.current;
      prevTotal.current = json.totals.total_votes;
      setData(json);
      setError(null);
      setUpdatedAt(Date.now());
      if (Object.keys(changed).length) {
        setFlash(changed);
        window.setTimeout(() => setFlash({}), 4000);
      }
      if (gained > 0) {
        setNewVotes(gained);
        window.setTimeout(() => setNewVotes(0), 4000);
      }
    } catch {
      setError("Auto-update terganggu, mencoba lagi.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (paused || document.hidden) return;
      load();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden && !paused) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, paused]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const totals = data?.totals ?? { total_voters: 0, voted: 0, total_votes: 0 };
  const participation = totals.total_voters ? Math.round((totals.voted / totals.total_voters) * 100) : 0;
  const nVoters = useCountUp(totals.total_voters);
  const nVoted = useCountUp(totals.voted);
  const nVotes = useCountUp(totals.total_votes);
  const nPart = useCountUp(participation);
  const maxVotes = Math.max(1, ...(data?.candidates ?? []).map((r) => r.votes));
  const leaderId = useMemo(() => {
    const sorted = [...(data?.candidates ?? [])].sort((a, b) => b.votes - a.votes);
    const top = sorted[0]?.votes ?? 0;
    if (top === 0) return null;
    if ((sorted[1]?.votes ?? 0) === top) return null;
    return sorted[0].id;
  }, [data]);
  const rows = useMemo(() => {
    const list = [...(data?.candidates ?? [])];
    return sort === "votes"
      ? list.sort((a, b) => b.votes - a.votes || a.number - b.number)
      : list.sort((a, b) => a.number - b.number);
  }, [data, sort]);

  const ringR = 26;
  const ringC = 2 * Math.PI * ringR;

  const stats = [
    { label: `${L.pemilih} Terdaftar`, value: nVoters, sub: `${lower(L.pemilih)} yang punya kode QR` },
    { label: `Sudah ${L.coblosKata}`, value: nVoted, sub: `${totals.total_voters - totals.voted} ${lower(L.pemilih)} belum ${L.coblosKata}` },
    { label: "Total Suara Masuk", value: nVotes, sub: `satu ${lower(L.pemilih)} dihitung satu suara` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">Rekapitulasi Suara</h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                error ? "bg-red-100 text-red-700" : paused ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${error ? "bg-red-500" : paused ? "bg-slate-500" : "live-dot bg-emerald-500"}`} />
              {error ? "TERPUTUS" : paused ? "DIJEDA" : "LIVE"}
            </span>
            {newVotes > 0 && (
              <span className="fade-up inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                +{newVotes} suara baru
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span>
              Status pemungutan:{" "}
              <span
                title={data?.status_reason}
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  data?.status === "closed" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {(data?.status_label || (data?.status === "closed" ? "Ditutup" : "Dibuka")).toUpperCase()}
              </span>
            </span>
            <span>
              Mode:{" "}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  data?.vote_mode === "live" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                }`}
                title={
                  data?.vote_mode === "live"
                    ? "1 undangan hanya berlaku 1 suara — suara terkunci"
                    : "Kode boleh dipakai ulang, suara terakhir yang dihitung"
                }
              >
                {data?.vote_mode === "live" ? "LIVE · 1 UNDIANGAN 1 SUARA" : "SIMULASI"}
              </span>
            </span>
            <span className="text-slate-300">|</span>
            <span>{updatedAt ? `Diperbarui ${timeAgo(new Date(updatedAt).toISOString(), now)}` : "Menghubungkan…"}</span>
            {error && <span className="text-red-600">{error}</span>}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPaused((p) => !p)} className={ghostBtn}>
            {paused ? "Lanjutkan" : "Jeda"}
          </button>
          <a href={`/api/e/${slug}/admin/rekap?csv=1`} className={ghostBtn}>
            Export CSV
          </a>
          <button type="button" onClick={load} className={solidBtn}>
            Muat Ulang
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{s.value}</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">{s.sub}</p>
          </div>
        ))}
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow">
          <div className="relative h-16 w-16 shrink-0">
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
              <circle cx="32" cy="32" r={ringR} fill="none" strokeWidth="7" className="stroke-slate-200" />
              <circle
                cx="32"
                cy="32"
                r={ringR}
                fill="none"
                strokeWidth="7"
                strokeLinecap="round"
                className="stroke-blue-600 transition-[stroke-dashoffset] duration-700 ease-out"
                strokeDasharray={ringC}
                strokeDashoffset={ringC * (1 - nPart / 100)}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold tabular-nums text-slate-900">
              {nPart}%
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Partisipasi</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
              {totals.voted} dari {totals.total_voters} {lower(L.pemilih)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800">Perolehan per {L.calonPendek}</h3>
            <div className="flex items-center gap-1 rounded-md bg-slate-100 p-0.5">
              {(["number", "votes"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSort(k)}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    sort === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {k === "number" ? "Nomor urut" : "Suara tertinggi"}
                </button>
              ))}
            </div>
          </div>

          {totals.total_votes === 0 && (
            <p className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              Belum ada suara masuk. Angka akan bergerak sendiri begitu {lower(L.pemilih)} {L.coblosKata} di kiosk.
            </p>
          )}

          <div className="mt-4 space-y-3">
            {rows.map((c) => {
              const pct = totals.total_votes ? (c.votes / totals.total_votes) * 100 : 0;
              const isLeader = c.id === leaderId;
              const delta = flash[c.id];
              return (
                <div
                  key={c.id}
                  className={`rounded-lg px-2 py-2 transition-colors ${
                    isLeader ? "bg-blue-50/70 ring-1 ring-blue-200" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img src={c.photo_url} alt={c.name} className="h-12 w-10 shrink-0 rounded border border-slate-200 object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-800">
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                            {c.number}
                          </span>
                          <span className="truncate">{c.name}</span>
                          {isLeader && (
                            <span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              TERATAS
                            </span>
                          )}
                        </p>
                        <p className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                          {c.votes}{" "}
                          <span className="text-[11px] font-normal text-slate-500">
                            ({totals.total_votes ? pct.toFixed(1) : "0.0"}%)
                          </span>
                        </p>
                      </div>
                      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-[width] duration-700 ease-out"
                          style={{ width: `${(c.votes / maxVotes) * 100}%` }}
                        />
                      </div>
                    </div>
                    {delta !== undefined && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          delta > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-800">Aktivitas Terkini</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {data?.recent.length ?? 0}
              </span>
            </div>
            <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto">
              {(data?.recent ?? []).map((r) => {
                const st = ACT_STYLE[r.action] ?? { dot: "bg-slate-400", label: r.action };
                return (
                  <li key={r.id} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-50">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-slate-700">{st.label}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500" title={r.detail}>
                        {r.detail}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{timeAgo(r.created_at, now)}</p>
                    </div>
                  </li>
                );
              })}
              {!data?.recent.length && (
                <li className="px-4 py-6 text-center text-xs text-slate-400">Belum ada aktivitas {L.coblosKata} tercatat.</li>
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Cara kerja pembaruan</h3>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-slate-500">
              <li>Halaman menarik rekap setiap 4 detik tanpa memuat ulang browser.</li>
              <li>Polling berhenti saat tab tidak aktif, lalu langsung sinkron ketika dibuka lagi.</li>
              <li>Pilihan {lower(L.pemilih)} tetap rahasia — aktivitas hanya menampilkan waktu suara masuk.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
