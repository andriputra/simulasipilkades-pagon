"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import {
  EVENT_KIND_LABELS,
  EVENT_KINDS,
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  EVENT_VOTE_MODES,
} from "@/lib/event-meta";

export type EventFormValues = {
  slug: string;
  name: string;
  kind: string;
  status: string;
  vote_mode: string;
  /** string "YYYY-MM-DDTHH:MM" waktu Jakarta, atau "" bila tidak dijadwalkan */
  opens_at: string;
  closes_at: string;
};

const fieldCls =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:border-violet-500 focus:outline-none";
const labelCls = "block text-xs font-semibold text-slate-600";

/** Identitas, status, mode, dan jadwal satu simulasi. */
export default function PlatformEventForm({ ev }: { ev: EventFormValues }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(ev);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof EventFormValues>(k: K, v: EventFormValues[K]) => setForm((f) => ({ ...f, [k]: v }));
  const keys = Object.keys(ev) as (keyof EventFormValues)[];
  const dirty = keys.some((k) => form[k] !== ev[k]);
  const jadwalSalah = Boolean(form.opens_at && form.closes_at && form.closes_at <= form.opens_at);

  const evKey = keys.map((k) => ev[k]).join("|");
  useEffect(() => {
    setForm(ev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evKey]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Server memperlakukan field yang tidak dikirim sebagai "pertahankan nilai
    // sekarang", jadi hanya field yang berubah yang dikirim.
    const patch: Partial<EventFormValues> = {};
    for (const k of keys) if (form[k] !== ev[k]) patch[k] = form[k];
    const res = await fetch(`/api/platform/e/${ev.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Gagal menyimpan.");
      toast(data.error || "Gagal menyimpan.", "error");
      return;
    }
    toast("Perubahan tersimpan.", "success");
    if (data.slug && data.slug !== ev.slug) {
      router.push(`/platform/e/${data.slug}`);
    } else {
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800">Identitas, status &amp; jadwal</h3>
      <p className="mt-1 text-xs text-slate-500">
        Kiosk menerima suara bila status manual <b>Terbuka</b> dan, ketika jam buka/tutup diisi, sekarang berada di
        antara kedua jam itu. Jadwal tidak menyalakan pemungutan; ia hanya memotong.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={`${labelCls} sm:col-span-2`}>
          Nama simulasi
          <input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} className={fieldCls} required />
        </label>

        <label className={labelCls}>
          URL simulasi
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400">/e/</span>
            <input
              value={form.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              maxLength={60}
              className={`${fieldCls} mt-0 font-mono text-xs`}
            />
          </div>
          <span className="mt-1 block text-[10px] text-slate-400">
            Mengubah URL membuat tautan lama dan cookie login panitia yang sudah ada tidak berlaku lagi.
          </span>
        </label>

        <label className={labelCls}>
          Jenis pemilihan
          <select value={form.kind} onChange={(e) => set("kind", e.target.value)} className={fieldCls}>
            {EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {EVENT_KIND_LABELS[k] || k}
              </option>
            ))}
          </select>
        </label>

        <label className={labelCls}>
          Status
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className={fieldCls}>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EVENT_STATUS_LABELS[s] || s}
              </option>
            ))}
          </select>
        </label>

        <label className={labelCls}>
          Mode pemungutan suara
          <select value={form.vote_mode} onChange={(e) => set("vote_mode", e.target.value)} className={fieldCls}>
            {EVENT_VOTE_MODES.map((m) => (
              <option key={m} value={m}>
                {m === "live" ? "Live — 1 suara terkunci" : "Simulasi — suara boleh diubah"}
              </option>
            ))}
          </select>
        </label>

        <label className={labelCls}>
          Jam buka (WIB)
          <input type="datetime-local" value={form.opens_at} onChange={(e) => set("opens_at", e.target.value)} className={fieldCls} />
        </label>
        <label className={labelCls}>
          Jam tutup (WIB)
          <input type="datetime-local" value={form.closes_at} onChange={(e) => set("closes_at", e.target.value)} className={fieldCls} />
        </label>
      </div>

      {jadwalSalah && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-600">
          Jam tutup harus setelah jam buka.
        </div>
      )}
      {error && <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !dirty || jadwalSalah}
          className="rounded-md bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {busy ? "Menyimpan…" : "Simpan Perubahan"}
        </button>
        {dirty && !busy && (
          <button
            type="button"
            onClick={() => setForm(ev)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Batalkan perubahan
          </button>
        )}
      </div>
    </form>
  );
}
