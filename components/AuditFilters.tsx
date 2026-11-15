"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type AuditFilterValues = {
  /** Terisi hanya di audit konsol platform (filter lintas simulasi). */
  event?: string;
  dari: string;
  sampai: string;
  jam_dari: string;
  jam_sampai: string;
  aksi: string;
  aktor: string;
  cari: string;
};

export const AUDIT_FILTER_KEYS = ["event", "dari", "sampai", "jam_dari", "jam_sampai", "aksi", "aktor", "cari"] as const;

const labelCls = "block text-[11px] font-semibold text-slate-600";
const fieldCls =
  "mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-normal text-slate-700 focus:border-blue-500 focus:outline-none";

const EMPTY: AuditFilterValues = { event: "", dari: "", sampai: "", jam_dari: "", jam_sampai: "", aksi: "", aktor: "", cari: "" };

export default function AuditFilters({
  values,
  aksiOptions,
  aktorOptions,
  eventOptions,
}: {
  values: AuditFilterValues;
  aksiOptions: string[];
  aktorOptions: string[];
  /** Bila diberikan, filter "Simulasi" ditampilkan (halaman audit konsol). */
  eventOptions?: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [form, setForm] = useState<AuditFilterValues>(values);

  // Selaraskan input saat pengguna memakai tombol back/forward browser.
  const urlKey = AUDIT_FILTER_KEYS.map((k) => values[k]).join("|");
  useEffect(() => {
    setForm(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  // Kolom teks ikut menerapkan filter setelah pengguna berhenti mengetik.
  useEffect(() => {
    if (form.cari === values.cari) return;
    const t = setTimeout(() => push(form), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cari, values.cari]);

  const set = (k: keyof AuditFilterValues, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const push = (next: AuditFilterValues) => {
    const params = new URLSearchParams();
    for (const k of AUDIT_FILTER_KEYS) {
      const v = (next[k] || "").trim();
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Dropdown/kalender/jam langsung menerapkan filter; teks bebas lewat tombol, Enter, atau setelah berhenti mengetik.
  const applyNow = (k: keyof AuditFilterValues, v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    push(next);
  };

  const isFiltered = AUDIT_FILTER_KEYS.some((k) => (form[k] || "").trim());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        push(form);
      }}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      {eventOptions && (
        <label className={`${labelCls} w-[13rem]`}>
          Simulasi
          <select value={form.event || ""} onChange={(e) => applyNow("event", e.target.value)} className={fieldCls}>
            <option value="">Semua simulasi</option>
            {eventOptions.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={`${labelCls} w-[9.5rem]`}>
        Tanggal dari
        <input type="date" value={form.dari} onChange={(e) => applyNow("dari", e.target.value)} className={fieldCls} />
      </label>
      <label className={`${labelCls} w-[9.5rem]`}>
        Tanggal sampai
        <input type="date" value={form.sampai} onChange={(e) => applyNow("sampai", e.target.value)} className={fieldCls} />
      </label>
      <label className={`${labelCls} w-[8.5rem]`}>
        Jam dari (WIB)
        <input type="time" value={form.jam_dari} onChange={(e) => applyNow("jam_dari", e.target.value)} className={fieldCls} />
      </label>
      <label className={`${labelCls} w-[8.5rem]`}>
        Jam sampai (WIB)
        <input type="time" value={form.jam_sampai} onChange={(e) => applyNow("jam_sampai", e.target.value)} className={fieldCls} />
      </label>
      <label className={`${labelCls} w-[11rem]`}>
        Aksi
        <select value={form.aksi} onChange={(e) => applyNow("aksi", e.target.value)} className={fieldCls}>
          <option value="">Semua aksi</option>
          {aksiOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label className={`${labelCls} w-[9rem]`}>
        Aktor
        <select value={form.aktor} onChange={(e) => applyNow("aktor", e.target.value)} className={fieldCls}>
          <option value="">Semua aktor</option>
          {aktorOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label className={`${labelCls} min-w-[13rem] max-w-[24rem] flex-1`}>
        Cari
        <input
          value={form.cari}
          onChange={(e) => set("cari", e.target.value)}
          placeholder="mis. VOTE_CAST, kiosk, 114.12"
          maxLength={120}
          className={fieldCls}
        />
      </label>

      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">
          Terapkan
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(EMPTY);
            push(EMPTY);
          }}
          disabled={!isFiltered}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Reset filter
        </button>
      </div>
    </form>
  );
}
